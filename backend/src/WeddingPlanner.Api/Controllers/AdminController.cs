using WeddingPlanner.Api.Auth;
using WeddingPlanner.Api.Dtos;
using WeddingPlanner.Domain.Entities;
using WeddingPlanner.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace WeddingPlanner.Api.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Roles = Roles.Admin)]
public class AdminController : ControllerBase
{
    private readonly AppDbContext _db;

    public AdminController(AppDbContext db) => _db = db;

    /// <summary>List vendors for moderation. `pending=true` returns only unapproved.</summary>
    [HttpGet("vendors")]
    public async Task<ActionResult<IEnumerable<AdminVendorDto>>> ListVendors([FromQuery] bool? pending)
    {
        var query = _db.Vendors.AsNoTracking().Include(v => v.Category).AsQueryable();
        if (pending == true)
            query = query.Where(v => !v.IsApproved);

        var vendors = await query
            .OrderByDescending(v => v.CreatedAt)
            .Select(v => new AdminVendorDto(
                v.Id, v.Name, v.Category.Slug, v.City, v.IsApproved, v.IsFeatured, v.CreatedAt,
                v.Slug, v.CitySlug,
                _db.Users.Any(u => u.VendorId == v.Id),
                v.Photos.Count))
            .ToListAsync();

        return Ok(vendors);
    }

    /// <summary>
    /// Add one vendor by hand: unapproved, no owner, the editor opens on it next. Same slug
    /// rules as self-registration. Bulk additions go through the spreadsheet import.
    /// </summary>
    [HttpPost("vendors")]
    public async Task<ActionResult<AdminVendorDto>> Create([FromBody] AdminCreateVendorDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        var category = await _db.Categories.FirstOrDefaultAsync(c => c.Slug == dto.CategorySlug);
        if (category is null) return BadRequest("Unknown category.");

        var v = new Vendor
        {
            Name = dto.Name.Trim(),
            Slug = $"pending-{Guid.NewGuid():N}",
            CategoryId = category.Id,
            City = dto.City?.Trim() ?? string.Empty,
            CitySlug = Slugs.From(dto.City),
            Bio = string.Empty,
            Phone = string.IsNullOrWhiteSpace(dto.Phone) ? null : dto.Phone.Trim(),
            Instagram = string.IsNullOrWhiteSpace(dto.Instagram) ? null : dto.Instagram.Trim(),
            IsApproved = false,
            IsFeatured = false,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        _db.Vendors.Add(v);
        await _db.SaveChangesAsync();

        var nameSlug = Slugs.From(v.Name);
        v.Slug = string.IsNullOrEmpty(nameSlug) ? $"vendor-{v.Id}" : $"{nameSlug}-{v.Id}";
        if (string.IsNullOrEmpty(v.CitySlug))
            v.CitySlug = $"city-{v.Id}";
        await _db.SaveChangesAsync();

        return Ok(new AdminVendorDto(v.Id, v.Name, category.Slug, v.City, v.IsApproved, v.IsFeatured,
            v.CreatedAt, v.Slug, v.CitySlug, false, 0));
    }

    [HttpPost("vendors/{id:int}/approve")]
    public async Task<IActionResult> Approve(int id)
    {
        var v = await _db.Vendors.FindAsync(id);
        if (v is null) return NotFound();
        v.IsApproved = true;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>Toggle the (dormant-monetization) featured flag.</summary>
    [HttpPost("vendors/{id:int}/feature")]
    public async Task<IActionResult> ToggleFeature(int id)
    {
        var v = await _db.Vendors.FindAsync(id);
        if (v is null) return NotFound();
        v.IsFeatured = !v.IsFeatured;
        await _db.SaveChangesAsync();
        return Ok(new { v.Id, v.IsFeatured });
    }
}
