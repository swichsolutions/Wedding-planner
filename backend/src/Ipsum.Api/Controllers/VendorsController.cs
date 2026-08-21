using Ipsum.Api.Dtos;
using Ipsum.Domain.Entities;
using Ipsum.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
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
            .Where(v => v.IsApproved)
            .Include(v => v.Category)
            .Include(v => v.Photos)
            .Include(v => v.Reviews)
            .AsQueryable();

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

        var vendors = await ordered
            .ThenBy(v => v.Name)
            .ToListAsync();

        return Ok(vendors.Select(ToDto));
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
