using System.Security.Claims;
using Ipsum.Api.Auth;
using Ipsum.Api.Dtos;
using Ipsum.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ipsum.Api.Controllers;

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
}
