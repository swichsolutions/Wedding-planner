using System.Net;
using System.Text;
using System.Threading.RateLimiting;
using Ipsum.Api.Auth;
using Ipsum.Infrastructure.Data;
using Ipsum.Infrastructure.Identity;
using Ipsum.Infrastructure.Storage;
using Microsoft.AspNetCore.Authentication.JwtBearer;
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
        npgsql => npgsql.MigrationsAssembly("Ipsum.Infrastructure")));

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
    .AddEntityFrameworkStores<AppDbContext>();
builder.Services.AddScoped<TokenService>();

// ---- JWT bearer auth ----
var jwt = builder.Configuration.GetSection("Jwt");
// Fail fast: a silent fallback here would mean production accepts tokens signed
// with a key that's public in the repo (mintable admin tokens).
var jwtKey = jwt["Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || jwtKey.Length < 32)
    throw new InvalidOperationException(
        "Jwt:Key is missing or shorter than 32 characters. Set it in appsettings.Development.json (dev) or environment configuration (production).");
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

// ---- Forwarded headers (only with an explicit trusted-proxy list) ----
// Behind a reverse proxy, Connection.RemoteIpAddress is the proxy's address, so
// every client shares ONE rate-limit partition — a single spammer exhausts the
// "messages" window for the whole site while the per-IP wall vanishes. But
// honoring X-Forwarded-For from arbitrary callers lets clients spoof their
// partition key, so the header is trusted only from proxies named in config.
// Must run before UseRateLimiter (and anything else reading the client IP).
var trustedProxies = builder.Configuration.GetSection("ForwardedHeaders:TrustedProxies").Get<string[]>();
if (trustedProxies is { Length: > 0 })
{
    var fwd = new ForwardedHeadersOptions
    {
        ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto,
    };
    fwd.KnownNetworks.Clear();
    fwd.KnownProxies.Clear();
    foreach (var ip in trustedProxies)
        fwd.KnownProxies.Add(IPAddress.Parse(ip));
    app.UseForwardedHeaders(fwd);
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Startup seeding. Roles run in EVERY environment — registration's AddToRoleAsync
// throws without them, so a fresh production DB would 500 on every sign-up.
// Dev additionally auto-migrates, seeds demo data, and creates the configured admin.
// Guarded so the API still boots if the database isn't up yet.
using (var scope = app.Services.CreateScope())
{
    try
    {
        if (app.Environment.IsDevelopment())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Database.MigrateAsync();
            await DbSeeder.SeedAsync(db);
        }

        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        await IdentitySeeder.SeedRolesAsync(roleManager);

        if (app.Environment.IsDevelopment())
        {
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
            await IdentitySeeder.SeedAdminAsync(userManager, app.Configuration);
        }
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
app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "ipsum-api" }));

app.Run();
