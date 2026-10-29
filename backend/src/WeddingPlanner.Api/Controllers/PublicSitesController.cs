using WeddingPlanner.Api.Dtos;
using WeddingPlanner.Api.Planning;
using WeddingPlanner.Domain.Entities;
using WeddingPlanner.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace WeddingPlanner.Api.Controllers;

/// <summary>Public side of couples' invitations (/w/{slug} pages) and the guests' answers on their
/// personal links (/w/{slug}/{code}, B6).</summary>
[ApiController]
[Route("api/sites")]
public class PublicSitesController : ControllerBase
{
    private readonly AppDbContext _db;

    public PublicSitesController(AppDbContext db) => _db = db;

    /// <summary>
    /// Guest-facing site finder (Zola-style). First name, last name AND year are all
    /// required so published sites can't be browsed wholesale — a guest has to know
    /// who they're looking for. The name matches either partner, case-insensitively,
    /// as a substring; results are ordered by closeness to the requested month.
    /// </summary>
    [HttpGet("search")]
    // The most expensive anonymous endpoint (three-column ILIKE scan) — throttled so
    // scripted name-pair iteration can't hammer the DB or harvest slugs at full speed.
    [EnableRateLimiting("tracking")]
    public async Task<ActionResult<IEnumerable<SiteSearchResultDto>>> Search(
        [FromQuery] string? firstName,
        [FromQuery] string? lastName,
        [FromQuery] int year,
        [FromQuery] int? month)
    {
        var first = firstName?.Trim();
        var last = lastName?.Trim();
        if (string.IsNullOrEmpty(first) || string.IsNullOrEmpty(last) || year is < 2000 or > 2100)
            return BadRequest();
        if (first.Length > 100 || last.Length > 100)
            return BadRequest();

        // Escape LIKE wildcards so "%"/"_" match literally — otherwise firstName=%
        // lists every published couple, defeating the you-must-know-them design.
        var fp = $"%{EscapeLike(first)}%";
        var lp = $"%{EscapeLike(last)}%";
        var target = month is >= 1 and <= 12 ? month.Value : 0;

        var results = await _db.WeddingSites
            .AsNoTracking()
            .Where(s => s.IsPublished && s.Slug != null && s.WeddingDate != null)
            .Where(s => s.WeddingDate!.Value.Year == year)
            .Where(s =>
                (EF.Functions.ILike(s.FirstName!, fp, "\\") && EF.Functions.ILike(s.LastName!, lp, "\\")) ||
                (EF.Functions.ILike(s.PartnerFirstName!, fp, "\\") && EF.Functions.ILike(s.PartnerLastName!, lp, "\\")))
            .OrderBy(s => target == 0 ? 0 : Math.Abs(s.WeddingDate!.Value.Month - target))
            .ThenBy(s => s.WeddingDate)
            .Take(20)
            .Select(s => new SiteSearchResultDto(
                s.FirstName, s.LastName, s.PartnerFirstName, s.PartnerLastName,
                s.WeddingDate!.Value, s.Place, s.Slug!))
            .ToListAsync();

        return Ok(results);
    }

    private static string EscapeLike(string value) =>
        value.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");

    private Task<WeddingSite?> PublishedAsync(string slug) =>
        _db.WeddingSites
            .AsNoTracking()
            .Include(s => s.Schedule)
            .Include(s => s.Photos)
            .AsSplitQuery()
            .FirstOrDefaultAsync(s => s.Slug == slug && s.IsPublished);

    [HttpGet("{slug}")]
    public async Task<ActionResult<PublicSiteDto>> Get(string slug)
    {
        var site = await PublishedAsync(slug);
        if (site is null) return NotFound();

        return Ok(new PublicSiteDto(
            site.TemplateKey,
            site.FirstName,
            site.PartnerFirstName,
            site.WeddingDate,
            site.Place,
            site.Message,
            site.InkColor,
            site.AccentColor,
            site.PhotoUrl,
            site.PhotoFocusX,
            site.PhotoFocusY,
            site.StartTime,
            site.FontKey,
            site.CeremonyName,
            site.CeremonyAddress,
            site.CeremonyTime,
            site.CeremonyMapUrl,
            site.ReceptionName,
            site.ReceptionAddress,
            site.ReceptionTime,
            site.ReceptionMapUrl,
            site.DressCode,
            site.Transport,
            site.Accommodation,
            WebsiteController.ScheduleOf(site),
            WebsiteController.PhotosOf(site),
            site.RsvpEnabled,
            site.RsvpDeadline,
            InviteRules.IsOpen(site)));
    }

    // ------------------------------------------------------------------ RSVP (B6)

    /// <summary>The guests one personal link answers for: a family, or a guest invited alone.</summary>
    private sealed record Invitees(GuestFamily? Family, Guest? Single, List<Guest> Guests);

    /// <summary>
    /// A guest's own code still works after they join a family: it then opens the family. Codes
    /// belong to one plan, so a code never opens another couple's guests through this slug.
    /// </summary>
    private async Task<Invitees?> FindPartyAsync(int coupleId, string code)
    {
        code = code.Trim().ToLowerInvariant();
        if (code.Length is 0 or > 16) return null;

        var family = await _db.GuestFamilies.FirstOrDefaultAsync(f => f.CoupleId == coupleId && f.InviteCode == code);
        if (family is null)
        {
            var guest = await _db.Guests.FirstOrDefaultAsync(g => g.CoupleId == coupleId && g.InviteCode == code);
            if (guest is null) return null;
            if (guest.FamilyId is not int fid) return new Invitees(null, guest, new List<Guest> { guest });
            family = await _db.GuestFamilies.FirstAsync(f => f.Id == fid);
        }
        var members = await _db.Guests.Where(g => g.FamilyId == family.Id).OrderBy(g => g.SortOrder).ToListAsync();
        return new Invitees(family, null, members);
    }

    private static string? Join(string? first, string? last)
    {
        var name = $"{first} {last}".Trim();
        return name.Length == 0 ? null : name;
    }

    private static RsvpPartyDto ToDto(WeddingSite site, Invitees party) => new(
        party.Family?.Name,
        party.Guests.Select(g => new RsvpGuestDto(
            g.Id,
            Join(g.FirstName, g.LastName)!,
            g.HasPlusOne,
            g.HasPlusOne && !g.PlusOneNameUnknown ? Join(g.PlusOneFirstName, g.PlusOneLastName) : null,
            g.HasChild,
            g.HasChild && !g.ChildNameUnknown ? Join(g.ChildFirstName, g.ChildLastName) : null,
            g.Attendance,
            g.DietaryNeeds)).ToList(),
        party.Family?.RsvpAt ?? party.Single?.RsvpAt,
        party.Family?.RsvpMessage ?? party.Single?.RsvpMessage,
        party.Family?.RsvpAnswer ?? party.Single?.RsvpAnswer,
        site.RsvpEnabled,
        InviteRules.IsOpen(site),
        site.RsvpDeadline,
        site.RsvpAskDiet,
        site.RsvpAskMessage,
        site.RsvpQuestion);

    /// <summary>A personal link's party: only its own names and answers. Read in the browser only
    /// (never during server rendering), so the per-IP limit counts the guest, not the SSR server.</summary>
    [HttpGet("{slug}/rsvp/{code}")]
    [EnableRateLimiting("tracking")]
    public async Task<ActionResult<RsvpPartyDto>> Party(string slug, string code)
    {
        var site = await PublishedAsync(slug);
        if (site is null) return NotFound();
        var party = await FindPartyAsync(site.CoupleId, code);
        if (party is null) return NotFound();
        return Ok(ToDto(site, party));
    }

    /// <summary>
    /// The party answers (or changes its answer while RSVP is open). Answers go straight to the
    /// couple's guest list; a "no" frees the guest's seats on the seating chart.
    /// </summary>
    [HttpPost("{slug}/rsvp/{code}")]
    [EnableRateLimiting("messages")]
    public async Task<ActionResult<RsvpPartyDto>> Answer(string slug, string code, [FromBody] RsvpSubmitDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        var site = await PublishedAsync(slug);
        if (site is null) return NotFound();
        var party = await FindPartyAsync(site.CoupleId, code);
        if (party is null) return NotFound();
        if (!InviteRules.IsOpen(site)) return Conflict(new { code = "closed" });

        if (dto.Guests.Count == 0
            || dto.Guests.Select(a => a.Id).Distinct().Count() != dto.Guests.Count
            || dto.Guests.Any(a => !InviteRules.Answers.Contains(a.Attendance)
                || party.Guests.All(g => g.Id != a.Id)))
            return BadRequest();

        var now = DateTimeOffset.UtcNow;
        foreach (var a in dto.Guests)
        {
            var guest = party.Guests.First(g => g.Id == a.Id);
            guest.Attendance = a.Attendance;
            guest.RsvpAt = now;
            if (a.Attendance != "yes") continue;
            if (site.RsvpAskDiet) guest.DietaryNeeds = Clean(a.DietaryNeeds);
            var plusOne = Clean(a.PlusOneName);
            if (guest.HasPlusOne && guest.PlusOneNameUnknown && plusOne is not null)
            {
                guest.PlusOneFirstName = plusOne;
                guest.PlusOneLastName = null;
                guest.PlusOneNameUnknown = false;
            }
        }

        var message = site.RsvpAskMessage ? Clean(dto.Message) : null;
        var answer = site.RsvpQuestion is not null ? Clean(dto.Answer) : null;
        if (party.Family is GuestFamily family)
        {
            family.RsvpAt = now;
            family.RsvpMessage = message;
            family.RsvpAnswer = answer;
        }
        else if (party.Single is Guest single)
        {
            single.RsvpMessage = message;
            single.RsvpAnswer = answer;
        }
        await _db.SaveChangesAsync();

        foreach (var guest in party.Guests.Where(g => g.Attendance == "no"))
            await SeatRules.FreeSeatsAsync(_db, guest);

        return Ok(ToDto(site, party));
    }

    private static string? Clean(string? s)
    {
        var trimmed = s?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }
}
