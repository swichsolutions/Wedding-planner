using WeddingPlanner.Api.Auth;
using WeddingPlanner.Api.Dtos;
using WeddingPlanner.Api.Planning;
using WeddingPlanner.Domain.Entities;
using WeddingPlanner.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace WeddingPlanner.Api.Controllers;

/// <summary>
/// The heart on vendor cards and profiles: which catalog vendors are in the couple's
/// „ჩემი მომსახურებები“ (<see cref="PlanService"/>, any status). Saving adds one as "saved";
/// removing takes it out of the list. The full list lives at /api/planning/services.
/// </summary>
[ApiController]
[Route("api/planning/saved")]
[Authorize(Roles = Roles.Couple)]
public class SavedVendorsController : ControllerBase
{
    private readonly AppDbContext _db;
    /// <summary>The shared plan this request works on (both partners see the same rows).</summary>
    private readonly CoupleScope _couple;

    public SavedVendorsController(AppDbContext db, CoupleScope couple)
    {
        _db = db;
        _couple = couple;
    }

    /// <summary>Vendor ids in the couple's services (newest first).</summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<int>>> List()
    {
        if (await _couple.IdAsync() is not int cid) return Forbid();

        var ids = await _db.PlanServices
            .AsNoTracking()
            .Where(s => s.CoupleId == cid && s.VendorId != null)
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => s.VendorId!.Value)
            .ToListAsync();

        return Ok(ids);
    }

    /// <summary>Save a vendor. Idempotent — saving an already-saved vendor is a no-op.</summary>
    [HttpPost]
    public async Task<IActionResult> Save([FromBody] SaveVendorDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (await _couple.IdAsync() is not int cid) return Forbid();

        // Approved vendors only — consistent with Messages/Reviews/Track.
        var vendor = await _db.Vendors.AsNoTracking()
            .Where(v => v.Id == dto.VendorId && v.IsApproved)
            .Select(v => new { v.Name, CategorySlug = v.Category.Slug })
            .FirstOrDefaultAsync();
        if (vendor is null) return NotFound();

        if (!await _db.PlanServices.AnyAsync(s => s.CoupleId == cid && s.VendorId == dto.VendorId))
        {
            _db.PlanServices.Add(new PlanService
            {
                CoupleId = cid,
                VendorId = dto.VendorId,
                Name = vendor.Name,
                CategorySlug = vendor.CategorySlug,
                Status = PlanServiceRules.Saved,
                CreatedAt = DateTimeOffset.UtcNow,
            });
            try
            {
                await _db.SaveChangesAsync();
            }
            catch (DbUpdateException ex) when (DbErrors.IsUniqueViolation(ex))
            {
                // Saved at the same moment from another tab (or by the partner): already there.
            }
        }

        return NoContent();
    }

    /// <summary>
    /// Un-save a vendor. Idempotent — removing one that isn't there still returns 204. A vendor the
    /// couple has worked on (shortlisted, chosen, an offer or a note) isn't dropped by a heart tap:
    /// 409 "inUse", and it's removed from „ჩემი მომსახურებები“ instead.
    /// </summary>
    [HttpDelete("{vendorId:int}")]
    public async Task<IActionResult> Remove(int vendorId)
    {
        if (await _couple.IdAsync() is not int cid) return Forbid();
        var mine = _db.PlanServices.Where(s => s.CoupleId == cid && s.VendorId == vendorId);
        var deleted = await mine
            .Where(s => s.Status == PlanServiceRules.Saved && s.Offer == null && s.OfferNote == null && s.Note == null)
            .ExecuteDeleteAsync();
        if (deleted == 0 && await mine.AnyAsync()) return Conflict(new { code = "inUse" });
        return NoContent();
    }
}
