using WeddingPlanner.Api.Auth;
using WeddingPlanner.Api.Dtos;
using WeddingPlanner.Api.Planning;
using WeddingPlanner.Domain.Entities;
using WeddingPlanner.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace WeddingPlanner.Api.Controllers;

/// <summary>The couple's named guest list. Unlike the checklist/budget, this never
/// auto-seeds — it starts empty so the page's own "add your first guest" prompt
/// is honest, not immediately contradicted by pre-filled rows. B5: attendance, dietary
/// needs and families (D9); a guest's changes reach the seating chart (a declined party, a
/// removed plus-one or child gives up its seats).</summary>
[ApiController]
[Route("api/planning/guests")]
[Authorize(Roles = Roles.Couple)]
public class GuestsController : ControllerBase
{
    private static readonly string[] Relationships =
    {
        "none", "person1_family", "person1_friend", "person1_family_friend",
        "person2_family", "person2_friend", "person2_family_friend", "both_friend",
    };

    private static readonly string[] InvitedStatuses = { "definitely", "maybe" };
    private static readonly string[] Attendances = { "pending", "yes", "no" };
    private const int MaxFamilies = 300;

    private readonly AppDbContext _db;
    /// <summary>The shared plan this request works on (both partners see the same rows).</summary>
    private readonly CoupleScope _couple;

    public GuestsController(AppDbContext db, CoupleScope couple)
    {
        _db = db;
        _couple = couple;
    }

    private static GuestDto ToDto(Guest g) => new(
        g.Id, g.FirstName, g.LastName, g.Email, g.Phone, g.Relationship, g.InvitedStatus,
        g.HasPlusOne, g.PlusOneFirstName, g.PlusOneLastName, g.PlusOneNameUnknown,
        g.HasChild, g.ChildFirstName, g.ChildLastName, g.ChildNameUnknown, g.SortOrder,
        g.Attendance, g.DietaryNeeds, g.FamilyId, g.RsvpAt, g.RsvpMessage, g.RsvpAnswer);

    [HttpGet]
    public async Task<ActionResult<IEnumerable<GuestDto>>> List()
    {
        if (await _couple.IdAsync() is not int cid) return Forbid();

        var guests = await _db.Guests
            .AsNoTracking()
            .Where(g => g.CoupleId == cid)
            .OrderBy(g => g.SortOrder)
            .ToListAsync();

        return Ok(guests.Select(ToDto));
    }

    [HttpPost]
    public async Task<ActionResult<GuestDto>> Create([FromBody] GuestCreateDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (await _couple.IdAsync() is not int cid) return Forbid();

        var maxSort = await _db.Guests
            .Where(g => g.CoupleId == cid)
            .Select(g => (int?)g.SortOrder)
            .MaxAsync() ?? -1;

        var guest = new Guest { CoupleId = cid, SortOrder = maxSort + 1, CreatedAt = DateTimeOffset.UtcNow };
        dto.FamilyId = await OwnFamilyAsync(cid, dto.FamilyId);
        Apply(guest, dto);
        _db.Guests.Add(guest);
        await _db.SaveChangesAsync();

        return Ok(ToDto(guest));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] GuestUpdateDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (await _couple.IdAsync() is not int cid) return Forbid();

        var guest = await _db.Guests.FirstOrDefaultAsync(g => g.Id == id && g.CoupleId == cid);
        if (guest is null) return NotFound();

        dto.FamilyId = await OwnFamilyAsync(cid, dto.FamilyId);
        Apply(guest, dto);
        await _db.SaveChangesAsync();
        await FreeSeatsAsync(guest);
        return NoContent();
    }

    /// <summary>The seating chart follows the guest: a declined party gives up all its seats, a
    /// plus-one or child no longer coming gives up theirs.</summary>
    private Task FreeSeatsAsync(Guest g) => SeatRules.FreeSeatsAsync(_db, g);

    // ------------------------------------------------------------------ families (D9)

    [HttpGet("families")]
    public async Task<ActionResult<IEnumerable<GuestFamilyDto>>> Families()
    {
        if (await _couple.IdAsync() is not int cid) return Forbid();
        return Ok(await _db.GuestFamilies.AsNoTracking()
            .Where(f => f.CoupleId == cid)
            .OrderBy(f => f.Name)
            .Select(f => new GuestFamilyDto(f.Id, f.Name, f.RsvpAt, f.RsvpMessage, f.RsvpAnswer))
            .ToListAsync());
    }

    [HttpPost("families")]
    public async Task<ActionResult<GuestFamilyDto>> CreateFamily([FromBody] GuestFamilyUpsertDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (await _couple.IdAsync() is not int cid) return Forbid();
        if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest();
        if (await _db.GuestFamilies.CountAsync(f => f.CoupleId == cid) >= MaxFamilies) return Conflict(new { code = "full" });

        var family = new GuestFamily { CoupleId = cid, Name = dto.Name.Trim(), CreatedAt = DateTimeOffset.UtcNow };
        _db.GuestFamilies.Add(family);
        await _db.SaveChangesAsync();
        return Ok(new GuestFamilyDto(family.Id, family.Name, family.RsvpAt, family.RsvpMessage, family.RsvpAnswer));
    }

    [HttpPut("families/{id:int}")]
    public async Task<ActionResult<GuestFamilyDto>> RenameFamily(int id, [FromBody] GuestFamilyUpsertDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (await _couple.IdAsync() is not int cid) return Forbid();
        if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest();
        var family = await _db.GuestFamilies.FirstOrDefaultAsync(f => f.Id == id && f.CoupleId == cid);
        if (family is null) return NotFound();

        family.Name = dto.Name.Trim();
        await _db.SaveChangesAsync();
        return Ok(new GuestFamilyDto(family.Id, family.Name, family.RsvpAt, family.RsvpMessage, family.RsvpAnswer));
    }

    /// <summary>Removes the family only; its guests stay on the list, ungrouped.</summary>
    [HttpDelete("families/{id:int}")]
    public async Task<IActionResult> DeleteFamily(int id)
    {
        if (await _couple.IdAsync() is not int cid) return Forbid();
        var deleted = await _db.GuestFamilies.Where(f => f.Id == id && f.CoupleId == cid).ExecuteDeleteAsync();
        return deleted == 0 ? NotFound() : NoContent();
    }

    /// <summary>Put the selected guests into a family, or take them out (FamilyId null).</summary>
    [HttpPut("family")]
    public async Task<IActionResult> AssignFamily([FromBody] GuestFamilyAssignDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (await _couple.IdAsync() is not int cid) return Forbid();
        if (dto.FamilyId is int fid && !await _db.GuestFamilies.AnyAsync(f => f.Id == fid && f.CoupleId == cid))
            return NotFound();

        await _db.Guests
            .Where(g => g.CoupleId == cid && dto.GuestIds.Contains(g.Id))
            .ExecuteUpdateAsync(u => u.SetProperty(g => g.FamilyId, dto.FamilyId));
        return NoContent();
    }

    /// <summary>A family id that belongs to this plan, else none.</summary>
    private async Task<int?> OwnFamilyAsync(int cid, int? familyId) =>
        familyId is int fid && await _db.GuestFamilies.AnyAsync(f => f.Id == fid && f.CoupleId == cid) ? fid : null;

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (await _couple.IdAsync() is not int cid) return Forbid();
        var guest = await _db.Guests.FirstOrDefaultAsync(g => g.Id == id && g.CoupleId == cid);
        if (guest is null) return NotFound();

        _db.Guests.Remove(guest);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static void Apply(Guest guest, GuestCreateDto dto)
    {
        guest.FirstName = dto.FirstName.Trim();
        guest.LastName = string.IsNullOrWhiteSpace(dto.LastName) ? null : dto.LastName.Trim();
        guest.Email = string.IsNullOrWhiteSpace(dto.Email) ? null : dto.Email.Trim();
        guest.Phone = string.IsNullOrWhiteSpace(dto.Phone) ? null : dto.Phone.Trim();
        guest.Relationship = Relationships.Contains(dto.Relationship) ? dto.Relationship! : "none";
        guest.InvitedStatus = InvitedStatuses.Contains(dto.InvitedStatus) ? dto.InvitedStatus! : "definitely";
        guest.Attendance = Attendances.Contains(dto.Attendance) ? dto.Attendance! : "pending";
        guest.DietaryNeeds = string.IsNullOrWhiteSpace(dto.DietaryNeeds) ? null : dto.DietaryNeeds.Trim();
        guest.FamilyId = dto.FamilyId;

        guest.HasPlusOne = dto.HasPlusOne;
        guest.PlusOneNameUnknown = dto.HasPlusOne && dto.PlusOneNameUnknown;
        guest.PlusOneFirstName = dto.HasPlusOne && !dto.PlusOneNameUnknown && !string.IsNullOrWhiteSpace(dto.PlusOneFirstName)
            ? dto.PlusOneFirstName!.Trim() : null;
        guest.PlusOneLastName = dto.HasPlusOne && !dto.PlusOneNameUnknown && !string.IsNullOrWhiteSpace(dto.PlusOneLastName)
            ? dto.PlusOneLastName!.Trim() : null;

        guest.HasChild = dto.HasChild;
        guest.ChildNameUnknown = dto.HasChild && dto.ChildNameUnknown;
        guest.ChildFirstName = dto.HasChild && !dto.ChildNameUnknown && !string.IsNullOrWhiteSpace(dto.ChildFirstName)
            ? dto.ChildFirstName!.Trim() : null;
        guest.ChildLastName = dto.HasChild && !dto.ChildNameUnknown && !string.IsNullOrWhiteSpace(dto.ChildLastName)
            ? dto.ChildLastName!.Trim() : null;
    }
}
