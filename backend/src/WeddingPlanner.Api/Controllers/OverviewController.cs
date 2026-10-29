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
/// „მიმოხილვა“ (guide §6, BUILD-PLAN B7): one read with a short summary of every organizer tool and
/// the banner's layers, so the overview doesn't load each tool in full. It never creates rows
/// (the budget's first read seeds lines; this one doesn't).
/// </summary>
[ApiController]
[Route("api/planning/overview")]
[Authorize(Roles = Roles.Couple)]
public class OverviewController : ControllerBase
{
    private const int BannerPhotos = 8;

    private readonly AppDbContext _db;
    private readonly CoupleScope _couple;

    public OverviewController(AppDbContext db, CoupleScope couple)
    {
        _db = db;
        _couple = couple;
    }

    [HttpGet]
    public async Task<ActionResult<OverviewDto>> Get()
    {
        if (await _couple.IdAsync() is not int cid) return Forbid();
        var plan = await _db.Couples.AsNoTracking()
            .Where(c => c.Id == cid)
            .Select(c => new { c.TotalBudget, c.PaletteKey })
            .FirstAsync();

        return Ok(new OverviewDto(
            await BudgetAsync(cid, plan.TotalBudget),
            await ServicesAsync(cid),
            await GuestsAsync(cid),
            await SeatingAsync(cid),
            await InvitationAsync(cid),
            await DayAsync(cid),
            await BannerAsync(cid, plan.PaletteKey)));
    }

    /// <summary>The couple's palette for the banner (null clears it).</summary>
    [HttpPut("palette")]
    public async Task<IActionResult> SetPalette([FromBody] PaletteUpdateDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (await _couple.IdAsync() is not int cid) return Forbid();
        var key = string.IsNullOrWhiteSpace(dto.Key) ? null : dto.Key.Trim();
        if (key is not null && !BannerRules.PaletteKeys.Contains(key)) return BadRequest();
        await _db.Couples.Where(c => c.Id == cid).ExecuteUpdateAsync(u => u.SetProperty(c => c.PaletteKey, key));
        return NoContent();
    }

    // ------------------------------------------------------------------ the parts

    private async Task<OverviewBudgetDto> BudgetAsync(int cid, decimal? total)
    {
        var lines = await _db.BudgetItems.AsNoTracking()
            .Where(i => i.CoupleId == cid)
            .Select(i => new { i.Id, i.Name, i.Estimate, i.ActualCost, i.Paid, i.ReminderDate })
            .ToListAsync();

        decimal LeftOf(decimal? agreed, decimal? estimate, decimal? paid) =>
            Math.Max(0, (agreed > 0 ? agreed.Value : estimate ?? 0) - (paid ?? 0));

        var next = lines
            .Where(i => i.ReminderDate != null && !(i.ActualCost > 0 && i.Paid >= i.ActualCost))
            .OrderBy(i => i.ReminderDate)
            .Take(3)
            .Select(i => new OverviewPaymentDto(i.Id, i.Name, i.ReminderDate!.Value, LeftOf(i.ActualCost, i.Estimate, i.Paid)))
            .ToList();

        return new OverviewBudgetDto(
            total,
            lines.Sum(i => i.Estimate ?? 0),
            lines.Sum(i => i.ActualCost ?? 0),
            lines.Sum(i => i.Paid ?? 0),
            lines.Where(i => i.ActualCost > 0).Sum(i => Math.Max(0, i.ActualCost!.Value - (i.Paid ?? 0))),
            next);
    }

    private async Task<OverviewServicesDto> ServicesAsync(int cid)
    {
        var rows = await _db.PlanServices.AsNoTracking()
            .Where(s => s.CoupleId == cid)
            .Select(s => new { s.Status, s.Name, s.CategorySlug, s.CreatedAt })
            .ToListAsync();
        var chosen = rows.Where(s => s.Status == PlanServiceRules.Chosen)
            .OrderBy(s => s.CreatedAt)
            .Select(s => new OverviewChosenDto(s.Name, s.CategorySlug))
            .ToList();
        return new OverviewServicesDto(
            rows.Count(s => s.Status == PlanServiceRules.Saved),
            rows.Count(s => s.Status == PlanServiceRules.Shortlist),
            chosen.Count,
            chosen.Take(6).ToList());
    }

    private async Task<OverviewGuestsDto> GuestsAsync(int cid)
    {
        var guests = await _db.Guests.AsNoTracking()
            .Where(g => g.CoupleId == cid)
            .Select(g => new
            {
                g.FirstName, g.LastName, g.FamilyId, g.Attendance, g.DietaryNeeds, g.HasPlusOne, g.HasChild,
                g.RsvpAt, g.RsvpMessage,
            })
            .ToListAsync();
        var families = await _db.GuestFamilies.AsNoTracking()
            .Where(f => f.CoupleId == cid)
            .Select(f => new { f.Id, f.Name, f.RsvpAt, f.RsvpMessage })
            .ToListAsync();

        int People(bool plusOne, bool child) => 1 + (plusOne ? 1 : 0) + (child ? 1 : 0);
        int PeopleWhere(string attendance) => guests.Where(g => g.Attendance == attendance).Sum(g => People(g.HasPlusOne, g.HasChild));

        // Personal links: families with someone in them, and guests outside a family.
        var withMembers = families.Where(f => guests.Any(g => g.FamilyId == f.Id)).ToList();
        var loose = guests.Where(g => g.FamilyId == null).ToList();

        var replies = withMembers
            .Where(f => f.RsvpAt != null)
            .Select(f =>
            {
                var members = guests.Where(g => g.FamilyId == f.Id).ToList();
                return new OverviewReplyDto(
                    f.Name, members.Count(g => g.Attendance == "yes"), members.Count(g => g.Attendance == "no"),
                    f.RsvpMessage, f.RsvpAt!.Value);
            })
            .Concat(loose.Where(g => g.RsvpAt != null).Select(g => new OverviewReplyDto(
                $"{g.FirstName} {g.LastName}".Trim(), g.Attendance == "yes" ? 1 : 0, g.Attendance == "no" ? 1 : 0,
                g.RsvpMessage, g.RsvpAt!.Value)))
            .OrderByDescending(r => r.At)
            .ToList();

        return new OverviewGuestsDto(
            guests.Count,
            guests.Sum(g => People(g.HasPlusOne, g.HasChild)),
            PeopleWhere("yes"),
            PeopleWhere("pending"),
            PeopleWhere("no"),
            guests.Count(g => g.Attendance != "no" && !string.IsNullOrWhiteSpace(g.DietaryNeeds)),
            withMembers.Count + loose.Count,
            replies.Count,
            replies.Take(3).ToList());
    }

    private async Task<OverviewSeatingDto> SeatingAsync(int cid)
    {
        var tables = await _db.SeatingTables.AsNoTracking()
            .Where(t => t.CoupleId == cid)
            .Select(t => t.SeatCount)
            .ToListAsync();
        var seated = await _db.SeatAssignments.CountAsync(a => a.CoupleId == cid);
        var toSeat = await _db.Guests.AsNoTracking()
            .Where(g => g.CoupleId == cid && g.Attendance != "no")
            .SumAsync(g => 1 + (g.HasPlusOne ? 1 : 0) + (g.HasChild ? 1 : 0));
        return new OverviewSeatingDto(tables.Count, tables.Sum(), seated, toSeat);
    }

    private async Task<OverviewInvitationDto> InvitationAsync(int cid)
    {
        var site = await _db.WeddingSites.AsNoTracking()
            .Where(s => s.CoupleId == cid)
            .Select(s => new { s.IsPublished, s.Slug, s.RsvpEnabled, s.RsvpDeadline })
            .FirstOrDefaultAsync();
        if (site is null) return new OverviewInvitationDto("none", null, null);
        return new OverviewInvitationDto(
            site.IsPublished ? "published" : "draft",
            site.IsPublished ? site.Slug : null,
            site.RsvpEnabled ? site.RsvpDeadline : null);
    }

    private async Task<OverviewDayDto> DayAsync(int cid)
    {
        var items = (await _db.WeddingDayItems.AsNoTracking()
                .Where(i => i.CoupleId == cid)
                .Select(i => new { i.Time, i.Activity, i.SortOrder })
                .ToListAsync())
            .OrderBy(i => WeddingDayController.TimeKey(i.Time))
            .ThenBy(i => i.SortOrder)
            .ToList();
        return new OverviewDayDto(
            items.Count,
            items.Take(3).Select(i => new OverviewDayItemDto(i.Time, i.Activity)).ToList(),
            items.LastOrDefault(i => i.Time != null)?.Time);
    }

    private async Task<OverviewBannerDto> BannerAsync(int cid, string? paletteKey)
    {
        // The chosen venue (the latest, if they chose more than one) and, from the catalog, its first photo.
        var venue = await _db.PlanServices.AsNoTracking()
            .Where(s => s.CoupleId == cid && s.Status == PlanServiceRules.Chosen && s.CategorySlug == BannerRules.VenueCategory)
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => new
            {
                s.Name,
                Photo = s.Vendor != null
                    ? s.Vendor.Photos.OrderBy(p => p.SortOrder).Select(p => p.Url).FirstOrDefault()
                    : null,
            })
            .FirstOrDefaultAsync();

        return new OverviewBannerDto(
            venue?.Name,
            venue?.Photo,
            paletteKey,
            await PlanPhotosController.ListAsync(_db, cid, BannerPhotos));
    }
}
