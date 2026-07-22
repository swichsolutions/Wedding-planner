using System.Text;
using Ipsum.Api.Auth;
using Ipsum.Infrastructure.Data;
using Ipsum.Infrastructure.Identity;
using Ipsum.Infrastructure.Storage;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
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
    })
    .AddRoles<IdentityRole>()
    .AddEntityFrameworkStores<AppDbContext>();
builder.Services.AddScoped<TokenService>();

// ---- JWT bearer auth ----
var jwt = builder.Configuration.GetSection("Jwt");
var jwtKey = jwt["Key"] ?? "dev-only-insecure-key-change-me-please-32+chars";
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

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();

    // Auto-apply migrations + seed in dev. Guarded so the API still boots if the
    // database isn't up yet (endpoints will then fail until it is).
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    try
    {
        await db.Database.MigrateAsync();
        await DbSeeder.SeedAsync(db);
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        await IdentitySeeder.SeedAsync(userManager, roleManager, app.Configuration);
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
});

app.UseCors(CorsPolicy);
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// Simple health/liveness endpoint.
app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "ipsum-api" }));

app.Run();
