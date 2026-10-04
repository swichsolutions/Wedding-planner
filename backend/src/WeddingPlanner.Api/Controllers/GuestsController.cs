using System.Security.Claims;
using WeddingPlanner.Api.Auth;
using WeddingPlanner.Api.Dtos;
using WeddingPlanner.Domain.Entities;
using WeddingPlanner.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace WeddingPlanner.Api.Controllers;

/// <summary>The couple's named guest list. Unlike the checklist/budget, this never
/// auto-seeds — it starts empty so the page's own "add your first guest" prompt
/// is honest, not immediately contradicted by pre-filled rows.</summary>
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

    private readonly AppDbContext _db;

    public GuestsController(AppDbContext db) => _db = db;

    private string? UserId => User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    private static GuestDto ToDto(Guest g) => new(
        g.Id, g.FirstName, g.LastName, g.Email, g.Phone, g.Relationship, g.InvitedStatus,
        g.HasPlusOne, g.PlusOneFirstName, g.PlusOneLastName, g.PlusOneNameUnknown,
        g.HasChild, g.ChildFirstName, g.ChildLastName, g.ChildNameUnknown, g.SortOrder);

    [HttpGet]
    public async Task<ActionResult<IEnumerable<GuestDto>>> List()
    {
        if (UserId is not string uid) return Forbid();

        var guests = await _db.Guests
            .AsNoTracking()
            .Where(g => g.UserId == uid)
            .OrderBy(g => g.SortOrder)
            .ToListAsync();

        return Ok(guests.Select(ToDto));
    }

    [HttpPost]
    public async Task<ActionResult<GuestDto>> Create([FromBody] GuestCreateDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (UserId is not string uid) return Forbid();

        var maxSort = await _db.Guests
            .Where(g => g.UserId == uid)
            .Select(g => (int?)g.SortOrder)
            .MaxAsync() ?? -1;

        var guest = new Guest { UserId = uid, SortOrder = maxSort + 1, CreatedAt = DateTimeOffset.UtcNow };
        Apply(guest, dto);
        _db.Guests.Add(guest);
        await _db.SaveChangesAsync();

        return Ok(ToDto(guest));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] GuestUpdateDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (UserId is not string uid) return Forbid();

        var guest = await _db.Guests.FirstOrDefaultAsync(g => g.Id == id && g.UserId == uid);
        if (guest is null) return NotFound();

        Apply(guest, dto);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (UserId is not string uid) return Forbid();
        var guest = await _db.Guests.FirstOrDefaultAsync(g => g.Id == id && g.UserId == uid);
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
