using WeddingPlanner.Api.Auth;
using WeddingPlanner.Api.Dtos;
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
                v.Id, v.Name, v.Category.Slug, v.City, v.IsApproved, v.IsFeatured, v.CreatedAt))
            .ToListAsync();

        return Ok(vendors);
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
