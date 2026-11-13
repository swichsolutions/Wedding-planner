using WeddingPlanner.Api.Auth;
using WeddingPlanner.Api.Dtos;
using WeddingPlanner.Api.Search;
using WeddingPlanner.Domain.Entities;
using WeddingPlanner.Infrastructure.Data;
using WeddingPlanner.Infrastructure.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace WeddingPlanner.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize(Roles = Roles.Vendor + "," + Roles.Admin)]
public class VendorDashboardController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<AppUser> _users;
    private readonly TokenService _tokens;
    private readonly IndexNowQueue _indexNow;

    public VendorDashboardController(AppDbContext db, UserManager<AppUser> users, TokenService tokens, IndexNowQueue indexNow)
    {
        _db = db;
        _users = users;
        _tokens = tokens;
        _indexNow = indexNow;
    }

    /// <summary>The vendor's own record, or any vendor for an admin on the admin routes.</summary>
    private int? VendorId => VendorScope.Resolve(User, RouteData);

    [HttpGet("vendor/me")]
    [HttpGet("admin/vendors/{vendorId:int}")]
    public async Task<ActionResult<VendorDashboardDto>> GetMe()
    {
        if (VendorId is not int id) return Forbid();

        var v = await _db.Vendors
            .Include(x => x.Category)
            .Include(x => x.Photos)
            .Include(x => x.Packages)
            .AsSplitQuery()
            .FirstOrDefaultAsync(x => x.Id == id);

        return v is null ? NotFound() : Ok(ToDashboard(v));
    }

    /// <summary>
    /// The signed-in vendor's takeover request (A3), for an account that has no vendor yet. 404
    /// when there is none; the dashboard then shows a plain load error.
    /// </summary>
    [HttpGet("vendor/me/claim")]
    public async Task<ActionResult<MyVendorClaimDto>> GetMyClaim()
    {
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value;
        if (string.IsNullOrEmpty(userId)) return Forbid();

        var claim = await _db.VendorClaims.AsNoTracking()
            .Where(c => c.UserId == userId)
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => new MyVendorClaimDto(
                c.VendorId, c.Vendor.Name, c.Vendor.Category.Slug, c.Vendor.City, c.Status.ToString(), c.CreatedAt))
            .FirstOrDefaultAsync();
        return claim is null ? NotFound() : Ok(claim);
    }

    /// <summary>
    /// A profile for a vendor account that has none. A rejected takeover request (A3), or a
    /// profile an admin removed, used to leave the account with nothing it could do. Same rules
    /// as registration: unapproved, the same slugs. It answers like sign-in, because the token
    /// names the vendor: the client replaces its token with the one in the answer.
    /// </summary>
    [HttpPost("vendor/me")]
    [Authorize(Roles = Roles.Vendor)]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<AuthResponseDto>> CreateMe([FromBody] VendorProfileCreateDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        var user = userId is null ? null : await _users.FindByIdAsync(userId);
        if (user is null) return Forbid();

        // Asked of the account, not the token: a token from before an approval still says "no vendor".
        if (user.VendorId is not null) return Conflict("The account already owns a profile.");
        // While a request waits, an admin may still link this account to the profile it asked for.
        if (await _db.VendorClaims.AnyAsync(c => c.UserId == user.Id && c.Status == VendorClaimStatus.Pending))
            return Conflict("A takeover request is still waiting for an answer.");

        var category = await _db.Categories.FirstOrDefaultAsync(c => c.Slug == dto.CategorySlug);
        if (category is null) return BadRequest("Unknown category.");

        // The vendor row and the link from the account are saved together or not at all.
        await using var tx = await _db.Database.BeginTransactionAsync();
        var vendor = new Vendor
        {
            Name = dto.VendorName.Trim(),
            Slug = $"pending-{Guid.NewGuid():N}", // unique until the id is known (see AuthController)
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
        user.VendorId = vendor.Id;
        // UpdateAsync saves the slugs too, and fails if the account changed meanwhile (the same
        // form sent twice, an admin approving a request): then nothing is kept.
        var linked = await _users.UpdateAsync(user);
        if (!linked.Succeeded) return Conflict("The account changed meanwhile. Reload and try again.");
        await tx.CommitAsync();

        var roles = await _users.GetRolesAsync(user);
        return Ok(new AuthResponseDto(_tokens.Create(user, roles), user.Email!, roles.ToArray(), user.VendorId));
    }

    [HttpPut("vendor/me")]
    [HttpPut("admin/vendors/{vendorId:int}")]
    public async Task<ActionResult<VendorDashboardDto>> UpdateMe([FromBody] VendorEditDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (VendorId is not int id) return Forbid();

        var v = await _db.Vendors.Include(x => x.Category).Include(x => x.Photos).Include(x => x.Packages)
            .AsSplitQuery()
            .FirstOrDefaultAsync(x => x.Id == id);
        if (v is null) return NotFound();

        if (dto.CapacityMin is int cmin && dto.CapacityMax is int cmax && cmin > cmax)
        {
            ModelState.AddModelError("capacityMin", "Minimum guests can't be more than maximum.");
            return ValidationProblem(ModelState);
        }

        // A non-empty WhatsApp value that doesn't normalize is a typo the vendor must
        // see — silently saving null returned 200 and the vendor believed it saved.
        var whatsapp = Contacts.NormalizeWhatsapp(dto.Whatsapp);
        if (whatsapp is null && !string.IsNullOrWhiteSpace(dto.Whatsapp))
        {
            ModelState.AddModelError("whatsapp",
                "Invalid WhatsApp number. Use a phone number like +995 5XX XX XX XX.");
            return ValidationProblem(ModelState);
        }

        var oldCitySlug = v.CitySlug;
        v.Name = dto.Name.Trim();
        var city = dto.City?.Trim();
        if (!string.IsNullOrEmpty(city) && city != v.City)
        {
            // Keep the URL/filter slug in sync with the label — otherwise the profile
            // says Batumi while its URL and the city filters still say Tbilisi.
            v.City = city;
            var citySlug = Slugs.From(city);
            v.CitySlug = citySlug.Length > 0 ? citySlug : $"city-{v.Id}";
        }
        v.Bio = dto.Bio?.Trim();
        v.PriceMin = dto.PriceMin;
        v.PriceRange = dto.PriceRange?.Trim();
        v.Instagram = dto.Instagram?.Trim();
        v.Facebook = dto.Facebook?.Trim();
        v.Phone = dto.Phone?.Trim();
        v.Whatsapp = whatsapp;
        v.MapUrl = dto.MapUrl?.Trim();
        v.AreasServed = dto.AreasServed?.Trim();
        await ApplyCatalogFieldsAsync(v, dto);
        await _db.SaveChangesAsync();

        if (v.IsApproved)
        {
            // a new city moves the page: the old address now answers 404
            if (oldCitySlug != v.CitySlug && oldCitySlug != "")
                _indexNow.Paths(IndexNowPaths.ForVendor(v.Category.Slug, v.Category.GroupKey, oldCitySlug, v.Slug).Take(2));
            _indexNow.Vendor(v.Id);
        }
        return Ok(ToDashboard(v));
    }

    /// <summary>
    /// The catalog attributes (PROPOSALS.md P2–P5). Values outside the allowed lists are dropped,
    /// attributes that don't apply to the vendor's group are cleared (venue fields for a
    /// photographer, styles for a cake shop), and "also offers" stays within the same group.
    /// </summary>
    private async Task ApplyCatalogFieldsAsync(Vendor v, VendorEditDto dto)
    {
        var group = v.Category.GroupKey;
        var sameGroup = await _db.Categories
            .Where(c => c.GroupKey == group && c.Id != v.CategoryId)
            .Select(c => c.Slug)
            .ToListAsync();

        var isVenue = group == "venues";
        v.PriceUnit = CatalogRules.OneOf(dto.PriceUnit, CatalogRules.PriceUnits);
        v.Region = CatalogRules.OneOf(dto.Region, CatalogRules.Regions);
        // A venue has one exact place (P4); only service vendors travel to other regions.
        v.ServedRegions = isVenue
            ? new List<string>()
            : CatalogRules.Clean(dto.ServedRegions, CatalogRules.Regions).Where(r => r != v.Region).ToList();
        v.AlsoOffers = CatalogRules.Clean(dto.AlsoOffers, sameGroup);
        v.Styles = CatalogRules.StyleGroups.Contains(group)
            ? CatalogRules.Clean(dto.Styles, CatalogRules.Styles)
                .Where(s => s != "documentary" || group == "photo").ToList()
            : new List<string>();
        v.Features = CatalogRules.Clean(dto.Features, CatalogRules.Features.GetValueOrDefault(group) ?? Array.Empty<string>());

        v.CapacityMin = isVenue ? dto.CapacityMin : null;
        v.CapacityMax = isVenue ? dto.CapacityMax : null;
        v.Setting = isVenue ? CatalogRules.OneOf(dto.Setting, CatalogRules.Settings) : null;
        v.VenueType = isVenue ? CatalogRules.OneOf(dto.VenueType, CatalogRules.VenueTypes) : null;

        v.DepositTerms = Clean(dto.DepositTerms);
        v.CancellationTerms = Clean(dto.CancellationTerms);
        v.TravelPolicy = CatalogRules.OneOf(dto.TravelPolicy, CatalogRules.TravelPolicies);
        v.BookingLeadTime = Clean(dto.BookingLeadTime);

        // Packages: the posted list replaces the saved one (null = leave them as they are).
        if (dto.Packages is not null)
        {
            _db.VendorPackages.RemoveRange(v.Packages);
            v.Packages = dto.Packages
                .Where(p => !string.IsNullOrWhiteSpace(p.Name))
                .Take(CatalogRules.MaxPackages)
                .Select((p, i) => new VendorPackage
                {
                    Name = p.Name.Trim(),
                    Price = p.Price,
                    PriceUnit = CatalogRules.OneOf(p.PriceUnit, CatalogRules.PriceUnits),
                    Included = Clean(p.Included),
                    Duration = Clean(p.Duration),
                    SortOrder = i,
                })
                .ToList();
        }
    }

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    // The inbox and stats are the vendor's own: no admin route.
    [HttpGet("vendor/me/messages")]
    [Authorize(Roles = Roles.Vendor)]
    public async Task<ActionResult<IEnumerable<InboxMessageDto>>> GetMessages()
    {
        if (VendorId is not int id) return Forbid();

        var messages = await _db.Messages
            .AsNoTracking()
            .Where(m => m.VendorId == id)
            .OrderByDescending(m => m.CreatedAt)
            .Select(m => new InboxMessageDto(
                m.Id, m.SenderName, m.SenderEmail, m.SenderPhone, m.Body, m.IsRead, m.CreatedAt))
            .ToListAsync();

        return Ok(messages);
    }

    [HttpPost("vendor/me/messages/{messageId:int}/read")]
    [Authorize(Roles = Roles.Vendor)]
    public async Task<IActionResult> MarkRead(int messageId)
    {
        if (VendorId is not int id) return Forbid();

        var msg = await _db.Messages.FirstOrDefaultAsync(m => m.Id == messageId && m.VendorId == id);
        if (msg is null) return NotFound();

        msg.IsRead = true;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("vendor/me/stats")]
    [Authorize(Roles = Roles.Vendor)]
    public async Task<ActionResult<VendorStatsDto>> GetStats()
    {
        if (VendorId is not int id) return Forbid();

        var stats = await _db.VendorStats.AsNoTracking().Where(s => s.VendorId == id).ToListAsync();
        var unread = await _db.Messages.CountAsync(m => m.VendorId == id && !m.IsRead);

        return Ok(new VendorStatsDto(
            stats.Sum(s => s.ProfileViews),
            stats.Sum(s => s.ContactClicks),
            stats.Sum(s => s.Messages),
            unread));
    }

    private static VendorDashboardDto ToDashboard(Vendor v) => new(
        v.Id, v.Name, v.Slug, v.Category.Slug, v.City, v.CitySlug,
        v.IsApproved, v.IsFeatured, v.Bio, v.PriceMin, v.PriceRange,
        v.Instagram, v.Facebook, v.Phone, v.Whatsapp, v.MapUrl, v.AreasServed,
        v.Photos.OrderBy(p => p.SortOrder)
            .Select(p => new VendorPhotoDto(p.Id, p.Url, p.AltText, p.IsRealWedding)).ToArray(),
        v.Category.GroupKey,
        v.PriceUnit,
        v.Region,
        v.ServedRegions.ToArray(),
        v.AlsoOffers.ToArray(),
        v.Styles.ToArray(),
        v.Features.ToArray(),
        v.CapacityMin,
        v.CapacityMax,
        v.Setting,
        v.VenueType,
        v.DepositTerms,
        v.CancellationTerms,
        v.TravelPolicy,
        v.BookingLeadTime,
        v.Packages.OrderBy(p => p.SortOrder)
            .Select(p => new VendorPackageEditDto
            {
                Name = p.Name,
                Price = p.Price,
                PriceUnit = p.PriceUnit,
                Included = p.Included,
                Duration = p.Duration,
            })
            .ToArray(),
        v.FloorPlanUrl);
}
