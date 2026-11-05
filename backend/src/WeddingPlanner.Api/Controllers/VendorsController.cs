using WeddingPlanner.Api.Dtos;
using WeddingPlanner.Domain.Entities;
using WeddingPlanner.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace WeddingPlanner.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class VendorsController : ControllerBase
{
    private readonly AppDbContext _db;

    public VendorsController(AppDbContext db) => _db = db;

    /// <summary>
    /// Imported profiles nobody owns yet, by name: the vendor registration form offers them so a
    /// vendor claims their listing instead of creating a second one (A3 takeover). Names, categories
    /// and cities are public on the profiles anyway.
    /// </summary>
    [HttpGet("claimable")]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<IEnumerable<ClaimableVendorDto>>> Claimable([FromQuery] string? q)
    {
        q = q?.Trim();
        if (string.IsNullOrEmpty(q) || q.Length < 2)
            return Ok(Array.Empty<ClaimableVendorDto>());

        // ILIKE wildcards in the typed text are literal; "\\" is the escape character below.
        var pattern = "%" + q.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_") + "%";
        var rows = await _db.Vendors.AsNoTracking()
            .Where(v => EF.Functions.ILike(v.Name, pattern, "\\") && !_db.Users.Any(u => u.VendorId == v.Id))
            .OrderBy(v => v.Name)
            .Take(8)
            .Select(v => new ClaimableVendorDto(v.Id, v.Name, v.Category.Slug, v.City, v.IsApproved))
            .ToListAsync();
        return Ok(rows);
    }

    /// <summary>Guest-capacity buckets (P2): key → the range a venue's capacity must overlap.</summary>
    private static readonly Dictionary<string, (int Lo, int Hi)> GuestBuckets = new()
    {
        ["100"] = (1, 100),
        ["200"] = (100, 200),
        ["350"] = (200, 350),
        ["350plus"] = (350, int.MaxValue),
    };

    /// <summary>
    /// List approved vendors with optional filters (the catalog, PROPOSALS.md P2). Every filter
    /// is optional; unknown values are ignored rather than rejected, so an old or hand-edited
    /// URL still shows results.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<VendorDto>>> List(
        [FromQuery] string? group,
        [FromQuery] string? category,
        [FromQuery] string? city,
        [FromQuery] string? region,
        [FromQuery] decimal? minPrice,
        [FromQuery] decimal? maxPrice,
        [FromQuery] string? styles,
        [FromQuery] string? guests,
        [FromQuery] string? setting,
        [FromQuery] string? venueType,
        [FromQuery] string? features,
        [FromQuery] string? q,
        [FromQuery] bool? featured,
        [FromQuery] string? sort)
    {
        var query = _db.Vendors
            .AsNoTracking()
            .Where(v => v.IsApproved);

        if (!string.IsNullOrWhiteSpace(group))
            query = query.Where(v => v.Category.GroupKey == group);
        // A category also matches vendors who list it under "also offers"
        // (a photographer who films shows up under videographers too).
        if (!string.IsNullOrWhiteSpace(category))
            query = query.Where(v => v.Category.Slug == category || v.AlsoOffers.Contains(category));
        if (!string.IsNullOrWhiteSpace(city))
            query = query.Where(v => v.CitySlug == city);
        // A region matches the vendor's own region and the regions they travel to.
        if (CatalogRules.OneOf(region, CatalogRules.Regions) is string r)
            query = query.Where(v => v.Region == r || v.ServedRegions.Contains(r));
        if (minPrice.HasValue)
            query = query.Where(v => v.PriceMin >= minPrice.Value);
        if (maxPrice.HasValue)
            query = query.Where(v => v.PriceMin <= maxPrice.Value);

        var styleList = CatalogRules.Clean(styles?.Split(','), CatalogRules.Styles);
        if (styleList.Count > 0)
            query = query.Where(v => v.Styles.Any(s => styleList.Contains(s)));

        // Capacity: the venue's range must overlap the bucket; venues without one don't match.
        if (guests is not null && GuestBuckets.TryGetValue(guests, out var bucket))
            query = query.Where(v => v.CapacityMax >= bucket.Lo && (v.CapacityMin ?? 0) <= bucket.Hi);
        // Indoor/outdoor: "both" venues qualify for either.
        if (CatalogRules.OneOf(setting, CatalogRules.Settings) is string st && st != "both")
            query = query.Where(v => v.Setting == st || v.Setting == "both");
        if (CatalogRules.OneOf(venueType, CatalogRules.VenueTypes) is string vt)
            query = query.Where(v => v.VenueType == vt);

        var allFeatures = CatalogRules.Features.Values.SelectMany(f => f).ToArray();
        foreach (var f in CatalogRules.Clean(features?.Split(','), allFeatures))
            query = query.Where(v => v.Features.Contains(f));

        // Free-text search over name, description and category name (either language).
        var term = q?.Trim();
        if (!string.IsNullOrEmpty(term) && term.Length <= 100)
        {
            var like = "%" + term.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_") + "%";
            query = query.Where(v =>
                EF.Functions.ILike(v.Name, like) ||
                EF.Functions.ILike(v.Bio ?? "", like) ||
                EF.Functions.ILike(v.Category.NameKa, like) ||
                EF.Functions.ILike(v.Category.NameEn, like));
        }

        if (featured == true)
            query = query.Where(v => v.IsFeatured);

        // sort=popular → lifetime profile views (the silently-tracked VendorStat data),
        // featured breaking the tie so real vendors lead while views are still scarce;
        // price_asc / price_desc → starting price, unpriced vendors last;
        // default → featured first. Name breaks remaining ties so ordering is stable.
        var ordered = sort switch
        {
            "popular" => query.OrderByDescending(v => v.Stats.Sum(s => (int?)s.ProfileViews) ?? 0)
                .ThenByDescending(v => v.IsFeatured),
            "price_asc" => query.OrderBy(v => v.PriceMin == null).ThenBy(v => v.PriceMin),
            "price_desc" => query.OrderBy(v => v.PriceMin == null).ThenByDescending(v => v.PriceMin),
            _ => query.OrderByDescending(v => v.IsFeatured),
        };

        // Project in SQL instead of materializing entity graphs: review aggregates are
        // computed by Postgres (bodies never leave the DB), and only the cover photo is
        // fetched — every list consumer (cards, budget picker) renders photos[0] only.
        var rows = await ordered
            .ThenBy(v => v.Name)
            .Select(v => new
            {
                v.Id,
                v.Name,
                v.Slug,
                CategorySlug = v.Category.Slug,
                v.City,
                v.CitySlug,
                v.AreasServed,
                v.PriceMin,
                v.PriceRange,
                v.Bio,
                v.Instagram,
                v.Facebook,
                v.Phone,
                v.Whatsapp,
                v.MapUrl,
                FirstPhoto = v.Photos
                    .OrderBy(p => p.SortOrder)
                    .Select(p => new { p.Id, p.Url, p.AltText, p.IsRealWedding })
                    .FirstOrDefault(),
                v.IsFeatured,
                ReviewCount = v.Reviews.Count(),
                AvgRating = v.Reviews.Average(r => (double?)r.Rating),
                v.Category.GroupKey,
                v.PriceUnit,
                v.Region,
                v.ServedRegions,
                v.AlsoOffers,
                v.Styles,
                v.Features,
                v.CapacityMin,
                v.CapacityMax,
                v.Setting,
                v.VenueType,
            })
            .ToListAsync();

        return Ok(rows.Select(r => new VendorDto(
            r.Id,
            r.Name,
            r.Slug,
            r.CategorySlug,
            r.City,
            r.CitySlug,
            r.AreasServed,
            r.PriceMin ?? 0,
            r.PriceRange,
            r.Bio ?? string.Empty,
            r.Instagram,
            r.Facebook,
            r.Phone,
            r.Whatsapp,
            r.MapUrl,
            r.FirstPhoto is null
                ? Array.Empty<VendorPhotoDto>()
                : new[] { new VendorPhotoDto(r.FirstPhoto.Id, r.FirstPhoto.Url, r.FirstPhoto.AltText, r.FirstPhoto.IsRealWedding) },
            r.IsFeatured,
            r.ReviewCount == 0 || r.AvgRating is null ? null : Math.Round(r.AvgRating.Value, 1),
            r.ReviewCount,
            r.GroupKey,
            r.PriceUnit ?? CatalogRules.DefaultPriceUnit(r.GroupKey),
            r.Region,
            r.ServedRegions.ToArray(),
            r.AlsoOffers.ToArray(),
            r.Styles.ToArray(),
            r.Features.ToArray(),
            r.CapacityMin,
            r.CapacityMax,
            r.Setting,
            r.VenueType,
            null,
            Array.Empty<VendorPackageDto>(),
            false)));
    }

    /// <summary>
    /// Distinct category×city pairings with approved-vendor counts — the SEO landing
    /// pages' cross-link data and the sitemap's page list. Cheap grouped read; left
    /// unthrottled like the main list (it renders on every landing page).
    /// </summary>
    [HttpGet("pairings")]
    public async Task<ActionResult<IEnumerable<VendorPairingDto>>> Pairings()
    {
        var rows = await _db.Vendors
            .AsNoTracking()
            .Where(v => v.IsApproved && v.CitySlug != "")
            .GroupBy(v => new { CategorySlug = v.Category.Slug, v.CitySlug })
            .Select(g => new
            {
                g.Key.CategorySlug,
                g.Key.CitySlug,
                // Max = a deterministic representative display name for the group.
                City = g.Max(v => v.City),
                Count = g.Count(),
            })
            .OrderByDescending(x => x.Count)
            .ThenBy(x => x.CategorySlug)
            .ThenBy(x => x.CitySlug)
            .ToListAsync();

        // Max() types as nullable, but GroupBy never yields an empty group.
        return Ok(rows.Select(x => new VendorPairingDto(x.CategorySlug, x.CitySlug, x.City ?? string.Empty, x.Count)));
    }

    /// <summary>
    /// Per-category inventory for the home-page index: approved-vendor count, the
    /// lowest listed starting price and the cities served (busiest first). Two grouped
    /// reads, both computed in Postgres; categories with no approved vendors are absent
    /// (the client treats a missing slug as "nothing yet").
    /// </summary>
    [HttpGet("categories")]
    public async Task<ActionResult<IEnumerable<CategoryStatDto>>> Categories()
    {
        var approved = _db.Vendors.AsNoTracking().Where(v => v.IsApproved);

        var cats = await approved
            .GroupBy(v => v.Category.Slug)
            .Select(g => new
            {
                Slug = g.Key,
                Count = g.Count(),
                // Min over listed prices only; SQL MIN of an empty set is NULL → no price shown.
                PriceMin = g.Where(v => v.PriceMin > 0).Min(v => v.PriceMin),
            })
            .ToListAsync();

        var cities = await approved
            .Where(v => v.CitySlug != "" && v.City != "")
            .GroupBy(v => new { CategorySlug = v.Category.Slug, v.CitySlug })
            .Select(g => new
            {
                g.Key.CategorySlug,
                g.Key.CitySlug,
                City = g.Max(v => v.City),
                Count = g.Count(),
            })
            .ToListAsync();

        var result = cats
            .OrderByDescending(c => c.Count)
            .ThenBy(c => c.Slug)
            .Select(c => new CategoryStatDto(
                c.Slug,
                c.Count,
                c.PriceMin,
                cities
                    .Where(x => x.CategorySlug == c.Slug)
                    .OrderByDescending(x => x.Count)
                    .ThenBy(x => x.CitySlug)
                    .Select(x => new CategoryCityDto(x.CitySlug, x.City ?? string.Empty, x.Count))
                    .ToList()));

        return Ok(result);
    }

    /// <summary>Single vendor by its SEO URL parts.</summary>
    [HttpGet("{category}/{city}/{slug}")]
    public async Task<ActionResult<VendorDto>> GetBySlug(string category, string city, string slug)
    {
        var vendor = await _db.Vendors
            .AsNoTracking()
            .Include(v => v.Category)
            .Include(v => v.Photos)
            .Include(v => v.Reviews)
            .Include(v => v.Packages)
            .AsSplitQuery()
            .FirstOrDefaultAsync(v =>
                v.IsApproved &&
                v.Category.Slug == category &&
                v.CitySlug == city &&
                v.Slug == slug);

        if (vendor is null) return NotFound();
        var hasOwner = await _db.Users.AnyAsync(u => u.VendorId == vendor.Id);
        return Ok(ToDto(vendor, hasOwner));
    }

    /// <summary>
    /// Anonymous engagement ping: the SPA reports a profile view (browser only, so
    /// SSR renders and crawlers don't count). Silent day-one stat collection — the
    /// future featured-placement sales tool (CLAUDE.md §5).
    /// </summary>
    [HttpPost("{id:int}/track-view")]
    [EnableRateLimiting("tracking")]
    public Task<IActionResult> TrackView(int id) => Track(id, views: 1);

    /// <summary>Anonymous engagement ping: a contact interaction (call/WhatsApp/social/message).</summary>
    [HttpPost("{id:int}/track-contact")]
    [EnableRateLimiting("tracking")]
    public Task<IActionResult> TrackContact(int id) => Track(id, contacts: 1);

    private async Task<IActionResult> Track(int id, int views = 0, int contacts = 0)
    {
        var exists = await _db.Vendors.AnyAsync(v => v.Id == id && v.IsApproved);
        if (!exists) return NotFound();

        await VendorStatTracking.IncrementAsync(_db, id, views: views, contacts: contacts);
        return NoContent();
    }

    private static VendorDto ToDto(Vendor v, bool acceptsMessages) => new(
        v.Id,
        v.Name,
        v.Slug,
        v.Category.Slug,
        v.City,
        v.CitySlug,
        v.AreasServed,
        v.PriceMin ?? 0,
        v.PriceRange,
        v.Bio ?? string.Empty,
        v.Instagram,
        v.Facebook,
        v.Phone,
        v.Whatsapp,
        v.MapUrl,
        v.Photos.OrderBy(p => p.SortOrder)
            .Select(p => new VendorPhotoDto(p.Id, p.Url, p.AltText, p.IsRealWedding))
            .ToArray(),
        v.IsFeatured,
        v.Reviews.Count == 0 ? null : Math.Round(v.Reviews.Average(r => r.Rating), 1),
        v.Reviews.Count,
        v.Category.GroupKey,
        v.PriceUnit ?? CatalogRules.DefaultPriceUnit(v.Category.GroupKey),
        v.Region,
        v.ServedRegions.ToArray(),
        v.AlsoOffers.ToArray(),
        v.Styles.ToArray(),
        v.Features.ToArray(),
        v.CapacityMin,
        v.CapacityMax,
        v.Setting,
        v.VenueType,
        v.DepositTerms is null && v.CancellationTerms is null && v.TravelPolicy is null && v.BookingLeadTime is null
            ? null
            : new VendorTermsDto(v.DepositTerms, v.CancellationTerms, v.TravelPolicy, v.BookingLeadTime),
        v.Packages.OrderBy(p => p.SortOrder)
            .Select(p => new VendorPackageDto(
                p.Name, p.Price, p.PriceUnit ?? v.PriceUnit ?? CatalogRules.DefaultPriceUnit(v.Category.GroupKey),
                p.Included, p.Duration))
            .ToArray(),
        acceptsMessages);
}
