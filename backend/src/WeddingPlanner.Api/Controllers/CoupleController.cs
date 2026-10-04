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
/// The signed-in couple's own onboarding profile (names, wedding date, planning stage,
/// needs). Powers personalization — greeting by name + the wedding countdown.
/// </summary>
[ApiController]
[Route("api/planning/couple")]
[Authorize(Roles = Roles.Couple)]
public class CoupleController : ControllerBase
{
    private readonly AppDbContext _db;

    public CoupleController(AppDbContext db) => _db = db;

    private string? UserId => User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    [HttpGet]
    public async Task<ActionResult<CoupleProfileDto>> Me()
    {
        if (UserId is not string uid) return Forbid();

        var couple = await _db.Couples
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.UserId == uid);

        // A couple account may predate onboarding — return an empty profile rather than 404.
        if (couple is null)
            return Ok(new CoupleProfileDto(null, null, null, null, null, null, null, Array.Empty<string>()));

        return Ok(new CoupleProfileDto(
            couple.FirstName,
            couple.LastName,
            couple.PartnerFirstName,
            couple.PartnerLastName,
            couple.WeddingDate,
            couple.PlanningStage,
            couple.GuestCountRange,
            couple.NeededCategories));
    }

    /// <summary>
    /// Re-run onboarding with new answers. Overwrites the profile and wipes the
    /// checklist + budget so they reseed fresh from the new answers on next load —
    /// this is destructive by design (the client confirms with the couple first).
    /// The old plan is NOT kept; a couple who wants to keep it simply doesn't call this.
    /// </summary>
    [HttpPut("restart")]
    public async Task<ActionResult<CoupleProfileDto>> Restart([FromBody] CoupleRestartDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (UserId is not string uid) return Forbid();

        await using var tx = await _db.Database.BeginTransactionAsync();

        var couple = await _db.Couples.FirstOrDefaultAsync(c => c.UserId == uid);
        if (couple is null)
        {
            var email = await _db.Users.Where(u => u.Id == uid).Select(u => u.Email).FirstOrDefaultAsync();
            couple = new Couple { UserId = uid, Email = email ?? string.Empty, CreatedAt = DateTimeOffset.UtcNow };
            _db.Couples.Add(couple);
        }

        couple.FirstName = dto.FirstName;
        couple.LastName = dto.LastName;
        couple.PartnerFirstName = dto.PartnerFirstName;
        couple.PartnerLastName = dto.PartnerLastName;
        couple.WeddingDate = dto.WeddingDate;
        couple.PlanningStage = dto.PlanningStage;
        couple.GuestCountRange = dto.GuestCountRange;
        couple.NeededCategories = dto.NeededCategories ?? new List<string>();
        couple.TotalBudget = null; // a fresh plan starts without a carried-over total

        // Wipe the old plan — GET /checklist and GET /budget reseed from the new
        // profile (needed categories) the next time the couple opens them.
        await _db.ChecklistItems.Where(c => c.UserId == uid).ExecuteDeleteAsync();
        await _db.BudgetItems.Where(b => b.UserId == uid).ExecuteDeleteAsync();
        await _db.CategoryBudgets.Where(c => c.UserId == uid).ExecuteDeleteAsync();
        await _db.Guests.Where(g => g.UserId == uid).ExecuteDeleteAsync();

        await _db.SaveChangesAsync();
        await tx.CommitAsync();

        return Ok(new CoupleProfileDto(
            couple.FirstName,
            couple.LastName,
            couple.PartnerFirstName,
            couple.PartnerLastName,
            couple.WeddingDate,
            couple.PlanningStage,
            couple.GuestCountRange,
            couple.NeededCategories));
    }
}
