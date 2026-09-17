using System.Text;
using System.Text.RegularExpressions;
using Google.Apis.Auth;
using WeddingPlanner.Api.Auth;
using WeddingPlanner.Api.Dtos;
using WeddingPlanner.Domain.Entities;
using WeddingPlanner.Infrastructure.Data;
using WeddingPlanner.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace WeddingPlanner.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly UserManager<AppUser> _users;
    private readonly AppDbContext _db;
    private readonly TokenService _tokens;
    private readonly IConfiguration _config;

    public AuthController(UserManager<AppUser> users, AppDbContext db, TokenService tokens, IConfiguration config)
    {
        _users = users;
        _db = db;
        _tokens = tokens;
        _config = config;
    }

    /// <summary>Vendor self-registration. Creates an unapproved Vendor + a Vendor-role user.</summary>
    [HttpPost("register/vendor")]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<AuthResponseDto>> RegisterVendor([FromBody] RegisterVendorDto dto)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var category = await _db.Categories.FirstOrDefaultAsync(c => c.Slug == dto.CategorySlug);
        if (category is null)
            return BadRequest("Unknown category.");

        if (await _users.FindByEmailAsync(dto.Email) is not null)
            return Conflict("Email already registered.");

        // Create the vendor first (unapproved) so we have an id for a unique slug.
        // The placeholder must itself be unique: a constant ("pending") violates the
        // (CategoryId, CitySlug, Slug) unique index when two registrations race.
        var vendor = new Vendor
        {
            Name = dto.VendorName.Trim(),
            Slug = $"pending-{Guid.NewGuid():N}",
            CategoryId = category.Id,
            City = dto.City?.Trim() ?? string.Empty,
            CitySlug = Slugs.From(dto.City),
            Bio = string.Empty,
            IsApproved = false,
            IsFeatured = false,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        _db.Vendors.Add(vendor);
        await _db.SaveChangesAsync();

        var nameSlug = Slugs.From(dto.VendorName);
        vendor.Slug = string.IsNullOrEmpty(nameSlug) ? $"vendor-{vendor.Id}" : $"{nameSlug}-{vendor.Id}";
        if (string.IsNullOrEmpty(vendor.CitySlug))
            vendor.CitySlug = $"city-{vendor.Id}";
        await _db.SaveChangesAsync();

        var user = new AppUser
        {
            UserName = dto.Email,
            Email = dto.Email,
            DisplayName = dto.VendorName.Trim(),
            VendorId = vendor.Id,
        };
        IdentityResult created;
        try
        {
            created = await _users.CreateAsync(user, dto.Password);
        }
        catch (DbUpdateException ex) when (DbErrors.IsUniqueViolation(ex))
        {
            // A concurrent registration with the same email slipped past the
            // FindByEmail pre-check. Clean up the orphaned vendor row.
            _db.ChangeTracker.Clear();
            _db.Vendors.Remove(vendor);
            await _db.SaveChangesAsync();
            return Conflict("Email already registered.");
        }
        if (!created.Succeeded)
        {
            _db.Vendors.Remove(vendor);
            await _db.SaveChangesAsync();
            return BadRequest(created.Errors.Select(e => e.Description));
        }

        await _users.AddToRoleAsync(user, Roles.Vendor);
        var roles = await _users.GetRolesAsync(user);
        return Ok(new AuthResponseDto(_tokens.Create(user, roles), user.Email!, roles.ToArray(), user.VendorId));
    }

    /// <summary>Couple self-registration (planning tools, wishlist sync, etc.).</summary>
    [HttpPost("register/couple")]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<AuthResponseDto>> RegisterCouple([FromBody] RegisterCoupleDto dto)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        if (await _users.FindByEmailAsync(dto.Email) is not null)
            return Conflict("Email already registered.");

        var user = new AppUser
        {
            UserName = dto.Email,
            Email = dto.Email,
            DisplayName = dto.FirstName?.Trim(),
        };
        IdentityResult created;
        try
        {
            created = await _users.CreateAsync(user, dto.Password);
        }
        catch (DbUpdateException ex) when (DbErrors.IsUniqueViolation(ex))
        {
            // A concurrent registration with the same email slipped past the pre-check.
            _db.ChangeTracker.Clear();
            return Conflict("Email already registered.");
        }
        if (!created.Succeeded)
            return BadRequest(created.Errors.Select(e => e.Description));

        await _users.AddToRoleAsync(user, Roles.Couple);

        // Persist the onboarding profile (one row per couple), linked by AppUser id.
        _db.Couples.Add(new Couple
        {
            UserId = user.Id,
            FirstName = dto.FirstName?.Trim(),
            LastName = dto.LastName?.Trim(),
            PartnerFirstName = dto.PartnerFirstName?.Trim(),
            PartnerLastName = dto.PartnerLastName?.Trim(),
            Email = dto.Email,
            WeddingDate = dto.WeddingDate,
            PlanningStage = dto.PlanningStage?.Trim(),
            GuestCountRange = dto.GuestCountRange?.Trim(),
            NeededCategories = (dto.NeededCategories ?? new List<string>())
                .Select(c => c.Trim())
                .Where(c => c.Length > 0)
                .Distinct()
                .ToList(),
            CreatedAt = DateTimeOffset.UtcNow,
        });
        await _db.SaveChangesAsync();

        var roles = await _users.GetRolesAsync(user);
        return Ok(new AuthResponseDto(_tokens.Create(user, roles), user.Email!, roles.ToArray(), user.VendorId));
    }

    [HttpPost("login")]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<AuthResponseDto>> Login([FromBody] LoginDto dto)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var user = await _users.FindByEmailAsync(dto.Email);
        if (user is null)
            return Unauthorized();

        // Every failure path answers the same bare 401 — responses must not reveal
        // whether the account exists or is currently locked out.
        if (await _users.IsLockedOutAsync(user))
            return Unauthorized();

        if (!await _users.CheckPasswordAsync(user, dto.Password))
        {
            // Counts toward the Lockout options in Program.cs — CheckPasswordAsync
            // alone never increments AccessFailedCount.
            await _users.AccessFailedAsync(user);
            return Unauthorized();
        }

        await _users.ResetAccessFailedCountAsync(user);
        var roles = await _users.GetRolesAsync(user);
        return Ok(new AuthResponseDto(_tokens.Create(user, roles), user.Email!, roles.ToArray(), user.VendorId));
    }

    /// <summary>
    /// Google sign-in. The browser sends the Google ID token (credential) from Google Identity
    /// Services; we verify it against our client id, then log the user in — creating a Couple
    /// account on first sign-in. Existing accounts (any role) are matched by email and logged in.
    /// </summary>
    [HttpPost("google")]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<AuthResponseDto>> Google([FromBody] GoogleLoginDto dto)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var clientId = _config["Google:ClientId"];
        if (string.IsNullOrWhiteSpace(clientId))
            return StatusCode(StatusCodes.Status503ServiceUnavailable, "Google sign-in is not configured.");

        GoogleJsonWebSignature.Payload payload;
        try
        {
            // Validates signature, expiry, issuer (accounts.google.com) and audience (our client id).
            payload = await GoogleJsonWebSignature.ValidateAsync(
                dto.Credential,
                new GoogleJsonWebSignature.ValidationSettings { Audience = new[] { clientId } });
        }
        catch (InvalidJwtException)
        {
            return Unauthorized();
        }

        if (!payload.EmailVerified || string.IsNullOrWhiteSpace(payload.Email))
            return Unauthorized();

        var email = payload.Email.Trim();
        var user = await _users.FindByEmailAsync(email);
        if (user is null)
        {
            // First Google sign-in → create an external-only (passwordless) Couple account.
            user = new AppUser
            {
                UserName = email,
                Email = email,
                EmailConfirmed = true,
                DisplayName = string.IsNullOrWhiteSpace(payload.GivenName) ? payload.Name : payload.GivenName,
            };
            IdentityResult created;
            try
            {
                created = await _users.CreateAsync(user);
            }
            catch (DbUpdateException ex) when (DbErrors.IsUniqueViolation(ex))
            {
                // Two concurrent first sign-ins (e.g. a double-clicked Google button):
                // the other request created the account — sign in with that one.
                _db.ChangeTracker.Clear();
                user = await _users.FindByEmailAsync(email);
                if (user is null) return Unauthorized();
                created = IdentityResult.Success;
            }
            if (!created.Succeeded)
                return BadRequest(created.Errors.Select(e => e.Description));

            if (await _db.Couples.FirstOrDefaultAsync(c => c.UserId == user.Id) is null)
            {
                await _users.AddToRoleAsync(user, Roles.Couple);
                _db.Couples.Add(new Couple
                {
                    UserId = user.Id,
                    FirstName = payload.GivenName,
                    LastName = payload.FamilyName,
                    Email = email,
                    CreatedAt = DateTimeOffset.UtcNow,
                });
                try
                {
                    await _db.SaveChangesAsync();
                }
                catch (DbUpdateException ex) when (DbErrors.IsUniqueViolation(ex))
                {
                    // The racing request inserted the Couple row first — theirs stands.
                    _db.ChangeTracker.Clear();
                }
            }
        }

        var roles = await _users.GetRolesAsync(user);
        return Ok(new AuthResponseDto(_tokens.Create(user, roles), user.Email!, roles.ToArray(), user.VendorId));
    }

}
