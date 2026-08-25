using Ipsum.Api.Dtos;
using Ipsum.Domain.Entities;
using Ipsum.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace Ipsum.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class VendorsController : ControllerBase
{
    private readonly AppDbContext _db;

    public VendorsController(AppDbContext db) => _db = db;

    /// <summary>List approved vendors with optional filters. Mirrors the frontend filter shape.</summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<VendorDto>>> List(
        [FromQuery] string? category,
        [FromQuery] string? city,
        [FromQuery] decimal? maxPrice,
        [FromQuery] bool? featured,
        [FromQuery] string? sort)
    {
        var query = _db.Vendors
            .AsNoTracking()
            .Where(v => v.IsApproved);

        if (!string.IsNullOrWhiteSpace(category))
            query = query.Where(v => v.Category.Slug == category);
        if (!string.IsNullOrWhiteSpace(city))
            query = query.Where(v => v.CitySlug == city);
        if (maxPrice.HasValue)
            query = query.Where(v => v.PriceMin <= maxPrice.Value);
        if (featured == true)
            query = query.Where(v => v.IsFeatured);

        // sort=popular → lifetime profile views (the silently-tracked VendorStat data),
        // featured breaking the tie so real vendors lead while views are still scarce;
        // default → featured first. Name breaks remaining ties so ordering is stable.
        var ordered = sort == "popular"
            ? query.OrderByDescending(v => v.Stats.Sum(s => (int?)s.ProfileViews) ?? 0)
                .ThenByDescending(v => v.IsFeatured)
            : query.OrderByDescending(v => v.IsFeatured);

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
                    .Select(p => new { p.Url, p.AltText, p.IsRealWedding })
                    .FirstOrDefault(),
                v.IsFeatured,
                ReviewCount = v.Reviews.Count(),
                AvgRating = v.Reviews.Average(r => (double?)r.Rating),
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
                : new[] { new VendorPhotoDto(r.FirstPhoto.Url, r.FirstPhoto.AltText, r.FirstPhoto.IsRealWedding) },
            r.IsFeatured,
            r.ReviewCount == 0 || r.AvgRating is null ? null : Math.Round(r.AvgRating.Value, 1),
            r.ReviewCount)));
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

    /// <summary>Single vendor by its SEO URL parts.</summary>
    [HttpGet("{category}/{city}/{slug}")]
    public async Task<ActionResult<VendorDto>> GetBySlug(string category, string city, string slug)
    {
        var vendor = await _db.Vendors
            .AsNoTracking()
            .Include(v => v.Category)
            .Include(v => v.Photos)
            .Include(v => v.Reviews)
            .FirstOrDefaultAsync(v =>
                v.IsApproved &&
                v.Category.Slug == category &&
                v.CitySlug == city &&
                v.Slug == slug);

        return vendor is null ? NotFound() : Ok(ToDto(vendor));
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

    private static VendorDto ToDto(Vendor v) => new(
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
            .Select(p => new VendorPhotoDto(p.Url, p.AltText, p.IsRealWedding))
            .ToArray(),
        v.IsFeatured,
        v.Reviews.Count == 0 ? null : Math.Round(v.Reviews.Average(r => r.Rating), 1),
        v.Reviews.Count);
}
