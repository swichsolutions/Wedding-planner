using WeddingPlanner.Api.Auth;
using WeddingPlanner.Api.Dtos;
using WeddingPlanner.Domain.Entities;
using WeddingPlanner.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace WeddingPlanner.Api.Controllers;

/// <summary>
/// Takeover requests (A3): a vendor registered and says an imported profile is theirs. The admin
/// checks (usually a call to the phone on the listing) and approves, which links the account to
/// the profile, or rejects. The vendor signs in again after approval to get a token for it.
/// </summary>
[ApiController]
[Route("api/admin/claims")]
[Authorize(Roles = Roles.Admin)]
public class AdminClaimsController : ControllerBase
{
    private readonly AppDbContext _db;

    public AdminClaimsController(AppDbContext db) => _db = db;

    /// <summary>All requests, pending first then newest first; `pending=true` returns only pending.</summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<VendorClaimDto>>> List([FromQuery] bool? pending)
    {
        var query = _db.VendorClaims.AsNoTracking()
            .Include(c => c.Vendor).ThenInclude(v => v.Category)
            .AsQueryable();
        if (pending == true)
            query = query.Where(c => c.Status == VendorClaimStatus.Pending);

        var rows = await query
            .OrderBy(c => c.Status != VendorClaimStatus.Pending)
            .ThenByDescending(c => c.CreatedAt)
            .Select(c => new VendorClaimDto(
                c.Id, c.VendorId, c.Vendor.Name, c.Vendor.Category.Slug, c.Vendor.City,
                c.UserEmail, c.EmailMatches, c.Status.ToString(), c.CreatedAt, c.DecidedAt))
            .ToListAsync();
        return Ok(rows);
    }

    /// <summary>Link the claimant's account to the profile; other pending requests for it are rejected.</summary>
    [HttpPost("{id:int}/approve")]
    public async Task<IActionResult> Approve(int id)
    {
        var claim = await _db.VendorClaims.FirstOrDefaultAsync(c => c.Id == id);
        if (claim is null) return NotFound();
        if (claim.Status != VendorClaimStatus.Pending) return Conflict("Already decided.");
        if (await _db.Users.AnyAsync(u => u.VendorId == claim.VendorId))
            return Conflict("This profile already has an owner.");

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == claim.UserId);
        if (user is null) return Conflict("The account no longer exists.");
        if (user.VendorId is not null) return Conflict("The account already owns a profile.");

        var now = DateTimeOffset.UtcNow;
        user.VendorId = claim.VendorId;
        claim.Status = VendorClaimStatus.Approved;
        claim.DecidedAt = now;

        var others = await _db.VendorClaims
            .Where(c => c.VendorId == claim.VendorId && c.Id != id && c.Status == VendorClaimStatus.Pending)
            .ToListAsync();
        foreach (var other in others)
        {
            other.Status = VendorClaimStatus.Rejected;
            other.DecidedAt = now;
        }

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id:int}/reject")]
    public async Task<IActionResult> Reject(int id)
    {
        var claim = await _db.VendorClaims.FirstOrDefaultAsync(c => c.Id == id);
        if (claim is null) return NotFound();
        if (claim.Status != VendorClaimStatus.Pending) return Conflict("Already decided.");
        claim.Status = VendorClaimStatus.Rejected;
        claim.DecidedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
