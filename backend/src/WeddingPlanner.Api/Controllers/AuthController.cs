using System.Text;
using System.Text.RegularExpressions;
using Google.Apis.Auth;
using WeddingPlanner.Api.Auth;
using WeddingPlanner.Api.Dtos;
using WeddingPlanner.Api.Planning;
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

        if (await _users.FindByEmailAsync(dto.Email) is not null)
            return Conflict("Email already registered.");

        // A profile an admin made, taken over with the one-time code the admin sent (ClaimCodes).
        if (!string.IsNullOrWhiteSpace(dto.ClaimCode))
            return await RegisterWithCode(dto);

        if (string.IsNullOrWhiteSpace(dto.VendorName))
        {
            ModelState.AddModelError(nameof(dto.VendorName), "The vendor name is required.");
            return ValidationProblem(ModelState);
        }
        var category = await _db.Categories.FirstOrDefaultAsync(c => c.Slug == dto.CategorySlug);
        if (category is null)
            return BadRequest("Unknown category.");

        // The vendor row and its account are saved together or not at all: a failure between
        // the two (anything but the cases answered below) used to leave a vendor nobody owns.
        // Leaving this method without committing rolls everything back.
        await using var tx = await _db.Database.BeginTransactionAsync();

        // Create the vendor first (unapproved) so we have an id for a unique slug.
        // The placeholder must itself be unique: a constant ("pending") violates the
        // (CategoryId, CitySlug, Slug) unique index when two registrations race.
        var vendor = new Vendor
        {
            Name = dto.VendorName!.Trim(),
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
            DisplayName = dto.VendorName!.Trim(),
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
            // FindByEmail pre-check. The vendor row goes with the rollback.
            return Conflict("Email already registered.");
        }
        if (!created.Succeeded)
            return BadRequest(created.Errors.Select(e => e.Description)); // rolled back, vendor row included

        await _users.AddToRoleAsync(user, Roles.Vendor);
        await tx.CommitAsync();
        var roles = await _users.GetRolesAsync(user);
        return Ok(new AuthResponseDto(_tokens.Create(user, roles), user.Email!, roles.ToArray(), user.VendorId));
    }

    /// <summary>
    /// Vendor registration with the one-time code an admin sent for a profile they made: the new
    /// account owns that profile at once, and the code is used up. Every failure about the code
    /// answers the same 404 (unknown, used, expired or already owned look alike to a guesser).
    /// </summary>
    private async Task<ActionResult<AuthResponseDto>> RegisterWithCode(RegisterVendorDto dto)
    {
        var hash = ClaimCodes.Hash(dto.ClaimCode);
        if (hash is null) return NotFound("invalid_code");

        await using var tx = await _db.Database.BeginTransactionAsync();
        var vendor = await _db.Vendors.AsNoTracking().FirstOrDefaultAsync(v =>
            v.ClaimCodeHash == hash && v.ClaimCodeExpiresAt > DateTimeOffset.UtcNow);
        if (vendor is null || await _db.Users.AnyAsync(u => u.VendorId == vendor.Id))
            return NotFound("invalid_code");

        // Used up first, in one conditional update: of two sign-ups racing with the same code the
        // second waits on the row and then finds no code left. A failure below rolls this back.
        var taken = await _db.Vendors
            .Where(v => v.Id == vendor.Id && v.ClaimCodeHash == hash)
            .ExecuteUpdateAsync(s => s
                .SetProperty(v => v.ClaimCodeHash, (string?)null)
                .SetProperty(v => v.ClaimCodeExpiresAt, (DateTimeOffset?)null));
        if (taken == 0) return NotFound("invalid_code");

        var user = new AppUser
        {
            UserName = dto.Email,
            Email = dto.Email,
            DisplayName = vendor.Name,
            VendorId = vendor.Id,
        };
        IdentityResult created;
        try
        {
            created = await _users.CreateAsync(user, dto.Password);
        }
        catch (DbUpdateException ex) when (DbErrors.IsUniqueViolation(ex))
        {
            return Conflict("Email already registered.");
        }
        if (!created.Succeeded)
            return BadRequest(created.Errors.Select(e => e.Description));

        await _users.AddToRoleAsync(user, Roles.Vendor);
        await tx.CommitAsync();

        var roles = await _users.GetRolesAsync(user);
        return Ok(new AuthResponseDto(_tokens.Create(user, roles), user.Email!, roles.ToArray(), user.VendorId));
    }

    /// <summary>
    /// What a code is for, before the vendor fills in the form: the profile's name, category and
    /// city. 404 for anything that can't be used (same answer for every reason).
    /// </summary>
    [HttpGet("vendor-code/{code}")]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<ClaimCodeInfoDto>> VendorCode(string code)
    {
        var hash = ClaimCodes.Hash(code);
        if (hash is null) return NotFound();
        var info = await _db.Vendors.AsNoTracking()
            .Where(v => v.ClaimCodeHash == hash && v.ClaimCodeExpiresAt > DateTimeOffset.UtcNow
                        && !_db.Users.Any(u => u.VendorId == v.Id))
            .Select(v => new ClaimCodeInfoDto(v.Name, v.Category.Slug, v.City))
            .FirstOrDefaultAsync();
        return info is null ? NotFound() : Ok(info);
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

        // The account's own plan (B1): details given now, or later in the start form.
        var plan = CoupleScope.NewPlan(user.Id);
        plan.FirstName = dto.FirstName?.Trim();
        plan.LastName = dto.LastName?.Trim();
        plan.PartnerFirstName = dto.PartnerFirstName?.Trim();
        plan.PartnerLastName = dto.PartnerLastName?.Trim();
        plan.WeddingDate = dto.WeddingDate;
        plan.PlanningStage = dto.PlanningStage?.Trim();
        plan.GuestCountRange = dto.GuestCountRange?.Trim();
        plan.NeededCategories = (dto.NeededCategories ?? new List<string>())
            .Select(c => c.Trim())
            .Where(c => c.Length > 0)
            .Distinct()
            .ToList();
        _db.Couples.Add(plan);
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
        // A first Google sign-in is a sign-up: the client then shows the start form.
        var isNew = false;
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

            if (!await _db.CoupleMembers.AnyAsync(m => m.UserId == user.Id))
            {
                await _users.AddToRoleAsync(user, Roles.Couple);
                var plan = CoupleScope.NewPlan(user.Id);
                plan.FirstName = payload.GivenName;
                plan.LastName = payload.FamilyName;
                _db.Couples.Add(plan);
                try
                {
                    await _db.SaveChangesAsync();
                }
                catch (DbUpdateException ex) when (DbErrors.IsUniqueViolation(ex))
                {
                    // The racing request started the plan first — theirs stands.
                    _db.ChangeTracker.Clear();
                }
                isNew = true;
            }
        }
        else if (!user.EmailConfirmed && user.PasswordHash is not null)
        {
            // Password sign-up never checks that the address is the person's own, so this
            // account may have been made by someone else with the owner's Gmail, waiting for
            // the owner to arrive through Google and fill in a plan the other person can read.
            // Google has now vouched for the real owner: the unproven password goes (the owner
            // can set one with "forgot password"), and the address counts as confirmed.
            user.EmailConfirmed = true;
            var secured = await _users.RemovePasswordAsync(user); // saves both changes
            if (!secured.Succeeded)
                return BadRequest(secured.Errors.Select(e => e.Description));
        }

        var roles = await _users.GetRolesAsync(user);
        return Ok(new AuthResponseDto(_tokens.Create(user, roles), user.Email!, roles.ToArray(), user.VendorId, isNew));
    }

}
