using System.Net;
using System.Text;
using System.Threading.RateLimiting;
using WeddingPlanner.Api.Auth;
using WeddingPlanner.Api.Email;
using WeddingPlanner.Infrastructure.Data;
using WeddingPlanner.Infrastructure.Email;
using WeddingPlanner.Infrastructure.Identity;
using WeddingPlanner.Infrastructure.Storage;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// ---- Database (PostgreSQL via Npgsql) ----
var connectionString = builder.Configuration.GetConnectionString("Default");
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(
        connectionString,
        npgsql => npgsql.MigrationsAssembly("WeddingPlanner.Infrastructure")));

// ---- Identity (Couple / Vendor / Admin) ----
builder.Services
    .AddIdentityCore<AppUser>(options =>
    {
        options.Password.RequiredLength = 8;
        // Keep uppercase + lowercase + digit; a symbol is not required (too strict for our users).
        options.Password.RequireNonAlphanumeric = false;
        options.User.RequireUniqueEmail = true;
        // Brute-force wall: five wrong passwords pause the account for five minutes.
        // Login records failures via AccessFailedAsync — CheckPasswordAsync alone
        // never increments the counter.
        options.Lockout.AllowedForNewUsers = true;
        options.Lockout.MaxFailedAccessAttempts = 5;
        options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
    })
    .AddRoles<IdentityRole>()
    .AddEntityFrameworkStores<AppDbContext>()
    .AddDefaultTokenProviders(); // password-reset tokens
builder.Services.AddScoped<TokenService>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<WeddingPlanner.Api.Planning.CoupleScope>();
builder.Services.Configure<DataProtectionTokenProviderOptions>(o =>
    o.TokenLifespan = PasswordResetEmail.LinkLifetime);
// The key ring that signs reset tokens lives in the database: on local disk it would vanish
// with every restart (Render's free tier sleeps), killing links already sent.
builder.Services.AddDataProtection()
    .SetApplicationName("weddingplanner")
    .PersistKeysToDbContext<AppDbContext>();

// ---- Email (SMTP when configured, else a log-only fallback that delivers nothing) ----
var smtp = builder.Configuration.GetSection("Email:Smtp");
var smtpConfigured = !string.IsNullOrWhiteSpace(smtp["Host"]);
if (smtpConfigured)
{
    var from = builder.Configuration["Email:From"];
    if (string.IsNullOrWhiteSpace(from))
        throw new InvalidOperationException("Email:From is required when Email:Smtp:Host is set.");
    builder.Services.AddSingleton<IEmailSender>(new SmtpEmailSender(new SmtpSettings(
        smtp["Host"]!,
        smtp.GetValue("Port", 587),
        smtp["Username"],
        smtp["Password"],
        smtp.GetValue("EnableSsl", true),
        from,
        builder.Configuration["Email:FromName"])));
}
else
{
    // Development logs the whole mail (copy the reset link from the console); elsewhere
    // only that a mail was dropped, since the body holds a live reset token.
    var logContent = builder.Environment.IsDevelopment();
    builder.Services.AddSingleton<IEmailSender>(sp =>
        new LogEmailSender(sp.GetRequiredService<ILogger<LogEmailSender>>(), logContent));
}
// Whether mail actually goes out: partner invites offer email only then (the link always works).
builder.Services.AddSingleton(new EmailDelivery(smtpConfigured));
builder.Services.AddSingleton<EmailOutbox>();
builder.Services.AddHostedService<EmailOutboxWorker>();
builder.Services.AddMemoryCache();

// ---- IndexNow: tells Bing & co. which public pages changed (on only for an https Site:PublicOrigin) ----
builder.Services.AddHttpClient(nameof(WeddingPlanner.Api.Search.IndexNowWorker), c => c.Timeout = TimeSpan.FromSeconds(20));
builder.Services.AddSingleton<WeddingPlanner.Api.Search.IndexNowQueue>();
builder.Services.AddHostedService<WeddingPlanner.Api.Search.IndexNowWorker>();

// ---- JWT bearer auth ----
var jwt = builder.Configuration.GetSection("Jwt");
// Fail fast: a silent fallback here would mean production accepts tokens signed
// with a key that's public in the repo (mintable admin tokens).
var jwtKey = jwt["Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || jwtKey.Length < 32)
    throw new InvalidOperationException(
        "Jwt:Key is missing or shorter than 32 characters. Set it in appsettings.Development.json (dev) or environment configuration (production).");
// Fail fast here too: without an issuer or audience the API starts, hands out tokens at
// sign-in and then rejects every one of them, which looks like "nobody can stay signed in".
if (!builder.Environment.IsDevelopment()
    && (string.IsNullOrWhiteSpace(jwt["Issuer"]) || string.IsNullOrWhiteSpace(jwt["Audience"])))
    throw new InvalidOperationException(
        "Jwt:Issuer and Jwt:Audience are required. Set them in environment configuration (Jwt__Issuer, Jwt__Audience).");
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwt["Issuer"],
            ValidateAudience = true,
            ValidAudience = jwt["Audience"],
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidateLifetime = true,
        };
    });
builder.Services.AddAuthorization();

// ---- Photo storage (Cloudinary when configured, else local disk fallback) ----
var cloud = builder.Configuration.GetSection("Cloudinary");
var uploadsRoot = Path.Combine(builder.Environment.ContentRootPath, "uploads");
Directory.CreateDirectory(uploadsRoot);
if (!string.IsNullOrWhiteSpace(cloud["CloudName"]))
{
    builder.Services.AddSingleton<IPhotoStorage>(new CloudinaryPhotoStorage(
        cloud["CloudName"]!, cloud["ApiKey"]!, cloud["ApiSecret"]!));
}
else
{
    var publicBase = builder.Configuration["LocalUploads:PublicBase"] ?? "http://localhost:5119/uploads";
    builder.Services.AddSingleton<IPhotoStorage>(new LocalPhotoStorage(uploadsRoot, publicBase));
}

// ---- MVC / API ----
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// ---- Rate limiting for the anonymous endpoints (messages, pings, auth) ----
// Per-client-IP fixed windows: enough for real couples, a wall for scripted spam
// that would otherwise flood inboxes and inflate the stats we'll someday sell
// featured placement with — and for credential stuffing against /api/auth/*.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddPolicy("messages", ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(1),
            }));

    // The /contact inquiry form: every request is a mail to our own inbox, so it is tighter
    // than "messages". Three in ten minutes is plenty for a person who mistypes and retries,
    // and keeps one address well under the form's site-wide hourly cap (ContactController).
    options.AddPolicy("contact", ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 3,
                Window = TimeSpan.FromMinutes(10),
            }));

    options.AddPolicy("tracking", ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 60,
                Window = TimeSpan.FromMinutes(1),
            }));

    options.AddPolicy("auth", ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
            }));
});

// ---- CORS for the Angular dev server ----
const string CorsPolicy = "frontend";
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                     ?? new[] { "http://localhost:4200" };
builder.Services.AddCors(options =>
    options.AddPolicy(CorsPolicy, policy =>
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()));

var app = builder.Build();

if (!smtpConfigured && !app.Environment.IsDevelopment())
    app.Logger.LogWarning("Email:Smtp:Host is not set — password-reset emails will NOT be delivered.");

// ---- Forwarded headers (only with an explicit trusted-proxy list) ----
// Behind a reverse proxy, Connection.RemoteIpAddress is the proxy's address, so
// every client shares ONE rate-limit partition — a single spammer exhausts the
// "messages" window for the whole site while the per-IP wall vanishes. But
// honoring X-Forwarded-For from arbitrary callers lets clients spoof their
// partition key, so the header is trusted only from proxies named in config.
// Must run before UseRateLimiter (and anything else reading the client IP).
var trustedProxies = builder.Configuration.GetSection("ForwardedHeaders:TrustedProxies").Get<string[]>();
// ForwardedHeaders:TrustAll=true accepts X-Forwarded-* from ANY upstream. Only for PaaS
// hosts (Render, Fly, Heroku) where the container is reachable solely through the
// platform's own proxy, whose IPs aren't published — never behind a reachable port.
var trustAllProxies = builder.Configuration.GetValue<bool>("ForwardedHeaders:TrustAll");
if (trustAllProxies || trustedProxies is { Length: > 0 })
{
    var fwd = new ForwardedHeadersOptions
    {
        ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto,
    };
    // Empty known lists = trust every upstream (TrustAll); otherwise only the listed IPs.
    fwd.KnownNetworks.Clear();
    fwd.KnownProxies.Clear();
    if (!trustAllProxies)
    {
        foreach (var ip in trustedProxies!)
            fwd.KnownProxies.Add(IPAddress.Parse(ip));
    }
    app.UseForwardedHeaders(fwd);
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Startup migrate + seeding. Roles and the category taxonomy run in EVERY environment —
// registration's AddToRoleAsync throws without roles, and vendor sign-up and the catalog need
// the categories, so a fresh production DB would otherwise break both. The admin account is
// created wherever Seed:AdminEmail/AdminPassword are configured (idempotent: only if missing).
// Migrations run in Development, or anywhere with Database:MigrateOnStartup=true (the live API
// on Render — docs/DEPLOY.md — has no other migration step). Demo vendors are Development only.
// Guarded so the API still boots if the database isn't up yet.
using (var scope = app.Services.CreateScope())
{
    try
    {
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        if (app.Environment.IsDevelopment() || app.Configuration.GetValue<bool>("Database:MigrateOnStartup"))
            await db.Database.MigrateAsync();

        // Roles first: they predate every recent migration, so they still seed on a
        // production DB whose newest migration hasn't been applied yet.
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        await IdentitySeeder.SeedRolesAsync(roleManager);

        await CategoryCatalog.SyncAsync(db);
        await LegalPagesSeeder.SeedAsync(db); // /terms and /privacy, only when missing
        await BlogArticlesSeeder.SeedAsync(db); // the first articles, once

        if (app.Environment.IsDevelopment())
            await DbSeeder.SeedAsync(db);

        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        await IdentitySeeder.SeedAdminAsync(userManager, app.Configuration, app.Logger);
    }
    catch (Exception ex)
    {
        app.Logger.LogWarning(ex, "DB migrate/seed skipped — is the database available?");
    }
}

app.UseHttpsRedirection();

// Serve locally-stored uploads (no-op when Cloudinary is used).
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadsRoot),
    RequestPath = "/uploads",
    OnPrepareResponse = ctx =>
        ctx.Context.Response.Headers["X-Content-Type-Options"] = "nosniff",
});

app.UseCors(CorsPolicy);
// After UseCors so throttled (429) responses still carry CORS headers.
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// Simple health/liveness endpoint.
app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "weddingplanner-api" }));

app.Run();
