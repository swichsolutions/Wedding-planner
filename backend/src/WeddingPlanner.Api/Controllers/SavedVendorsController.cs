using System.Security.Claims;
using WeddingPlanner.Api.Auth;
using WeddingPlanner.Api.Dtos;
using WeddingPlanner.Domain.Entities;
using WeddingPlanner.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace WeddingPlanner.Api.Controllers;

/// <summary>
/// A couple's saved-vendor wishlist. Keyed by AppUser.Id — mirrors ChecklistController.
/// The couple-facing UI syncs its heart toggles here so the list follows the account
/// across devices (replaces the old localStorage-only wishlist).
/// </summary>
[ApiController]
[Route("api/planning/saved")]
[Authorize(Roles = Roles.Couple)]
public class SavedVendorsController : ControllerBase
{
    private readonly AppDbContext _db;

    public SavedVendorsController(AppDbContext db) => _db = db;

    private string? UserId => User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    /// <summary>Vendor ids this couple has saved (newest first).</summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<int>>> List()
    {
        if (UserId is not string uid) return Forbid();

        var ids = await _db.SavedVendors
            .AsNoTracking()
            .Where(s => s.UserId == uid)
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => s.VendorId)
            .ToListAsync();

        return Ok(ids);
    }

    /// <summary>Save a vendor. Idempotent — saving an already-saved vendor is a no-op.</summary>
    [HttpPost]
    public async Task<IActionResult> Save([FromBody] SaveVendorDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (UserId is not string uid) return Forbid();

        // Approved vendors only — consistent with Messages/Reviews/Track.
        if (!await _db.Vendors.AnyAsync(v => v.Id == dto.VendorId && v.IsApproved))
            return NotFound();

        var already = await _db.SavedVendors
            .AnyAsync(s => s.UserId == uid && s.VendorId == dto.VendorId);
        if (!already)
        {
            _db.SavedVendors.Add(new SavedVendor
            {
                UserId = uid,
                VendorId = dto.VendorId,
                CreatedAt = DateTimeOffset.UtcNow,
            });
            await _db.SaveChangesAsync();
        }

        return NoContent();
    }

    /// <summary>Unsave a vendor. Idempotent — removing one that isn't saved still returns 204.</summary>
    [HttpDelete("{vendorId:int}")]
    public async Task<IActionResult> Remove(int vendorId)
    {
        if (UserId is not string uid) return Forbid();

        var row = await _db.SavedVendors
            .FirstOrDefaultAsync(s => s.UserId == uid && s.VendorId == vendorId);
        if (row is not null)
        {
            _db.SavedVendors.Remove(row);
            await _db.SaveChangesAsync();
        }

        return NoContent();
    }
}
