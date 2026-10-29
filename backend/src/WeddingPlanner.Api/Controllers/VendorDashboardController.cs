using WeddingPlanner.Api.Auth;
using WeddingPlanner.Api.Dtos;
using WeddingPlanner.Domain.Entities;
using WeddingPlanner.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace WeddingPlanner.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize(Roles = Roles.Vendor + "," + Roles.Admin)]
public class VendorDashboardController : ControllerBase
{
    private readonly AppDbContext _db;

    public VendorDashboardController(AppDbContext db) => _db = db;

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
            .ToArray());
}
