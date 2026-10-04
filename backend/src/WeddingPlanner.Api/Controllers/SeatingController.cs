using System.Security.Claims;
using WeddingPlanner.Api.Auth;
using WeddingPlanner.Api.Dtos;
using WeddingPlanner.Domain.Entities;
using WeddingPlanner.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace WeddingPlanner.Api.Controllers;

/// <summary>The couple's seating chart: tables (free-form canvas position, shape,
/// seat count) and per-seat attendee assignments. Never auto-seeds — starts empty,
/// same as the guest list.</summary>
[ApiController]
[Route("api/planning/seating")]
[Authorize(Roles = Roles.Couple)]
public class SeatingController : ControllerBase
{
    private static readonly string[] Shapes = { "round", "rectangular", "one_sided", "four_sided" };
    private static readonly string[] AttendeeKinds = { "primary", "plus_one", "child" };
    private static readonly string[] ObjectTypes =
    {
        "dance_floor", "cake_table", "gift_table", "buffet_table", "bar",
        "dj_booth", "band", "photo_booth", "stage", "podium", "entrance", "door",
    };

    private readonly AppDbContext _db;

    public SeatingController(AppDbContext db) => _db = db;

    private string? UserId => User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    private static SeatingTableDto ToDto(SeatingTable t) =>
        new(t.Id, t.Name, t.Shape, t.SeatCount, t.PositionX, t.PositionY);

    private static SeatAssignmentDto ToDto(SeatAssignment a) =>
        new(a.TableId, a.SeatIndex, a.GuestId, a.AttendeeKind);

    private static SeatingObjectDto ToDto(SeatingObject o) =>
        new(o.Id, o.Type, o.PositionX, o.PositionY, o.Width, o.Height);

    [HttpGet]
    public async Task<ActionResult<SeatingStateDto>> Get()
    {
        if (UserId is not string uid) return Forbid();

        var tables = await _db.SeatingTables.AsNoTracking().Where(t => t.UserId == uid).ToListAsync();
        var assignments = await _db.SeatAssignments.AsNoTracking().Where(a => a.UserId == uid).ToListAsync();
        var objects = await _db.SeatingObjects.AsNoTracking().Where(o => o.UserId == uid).ToListAsync();

        return Ok(new SeatingStateDto(tables.Select(ToDto), assignments.Select(ToDto), objects.Select(ToDto)));
    }

    [HttpPost("tables")]
    public async Task<ActionResult<SeatingTableDto>> CreateTable([FromBody] SeatingTableCreateDto dto)
    {
        if (!ModelState.IsValid || !Shapes.Contains(dto.Shape)) return ValidationProblem(ModelState);
        if (UserId is not string uid) return Forbid();

        var table = new SeatingTable
        {
            UserId = uid,
            Name = dto.Name.Trim(),
            Shape = dto.Shape,
            SeatCount = dto.SeatCount,
            PositionX = dto.PositionX,
            PositionY = dto.PositionY,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        _db.SeatingTables.Add(table);
        await _db.SaveChangesAsync();

        return Ok(ToDto(table));
    }

    [HttpPut("tables/{id:int}")]
    public async Task<IActionResult> UpdateTable(int id, [FromBody] SeatingTableUpdateDto dto)
    {
        if (!ModelState.IsValid || !Shapes.Contains(dto.Shape)) return ValidationProblem(ModelState);
        if (UserId is not string uid) return Forbid();

        var table = await _db.SeatingTables.FirstOrDefaultAsync(t => t.Id == id && t.UserId == uid);
        if (table is null) return NotFound();

        table.Name = dto.Name.Trim();
        table.Shape = dto.Shape;
        table.SeatCount = dto.SeatCount;
        table.PositionX = dto.PositionX;
        table.PositionY = dto.PositionY;

        // Shrinking the seat count orphans any assignment that no longer fits.
        var overflow = _db.SeatAssignments.Where(a => a.TableId == id && a.SeatIndex >= dto.SeatCount);
        _db.SeatAssignments.RemoveRange(overflow);

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("tables/{id:int}")]
    public async Task<IActionResult> DeleteTable(int id)
    {
        if (UserId is not string uid) return Forbid();
        var table = await _db.SeatingTables.FirstOrDefaultAsync(t => t.Id == id && t.UserId == uid);
        if (table is null) return NotFound();

        _db.SeatingTables.Remove(table); // cascades to its seat assignments
        await _db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>Seats one attendee — clears whatever else was in that exact seat and
    /// any other seat that same attendee already held (an attendee sits in one place).</summary>
    [HttpPut("assign")]
    public async Task<IActionResult> Assign([FromBody] SeatAssignDto dto)
    {
        if (!ModelState.IsValid || !AttendeeKinds.Contains(dto.AttendeeKind)) return ValidationProblem(ModelState);
        if (UserId is not string uid) return Forbid();

        var table = await _db.SeatingTables.FirstOrDefaultAsync(t => t.Id == dto.TableId && t.UserId == uid);
        if (table is null) return NotFound();
        if (dto.SeatIndex < 0 || dto.SeatIndex >= table.SeatCount) return BadRequest();

        var guest = await _db.Guests.FirstOrDefaultAsync(g => g.Id == dto.GuestId && g.UserId == uid);
        if (guest is null) return NotFound();

        var existing = _db.SeatAssignments.Where(a => a.UserId == uid &&
            ((a.TableId == dto.TableId && a.SeatIndex == dto.SeatIndex) ||
             (a.GuestId == dto.GuestId && a.AttendeeKind == dto.AttendeeKind)));
        _db.SeatAssignments.RemoveRange(existing);

        _db.SeatAssignments.Add(new SeatAssignment
        {
            UserId = uid,
            TableId = dto.TableId,
            SeatIndex = dto.SeatIndex,
            GuestId = dto.GuestId,
            AttendeeKind = dto.AttendeeKind,
        });
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("assign/{tableId:int}/{seatIndex:int}")]
    public async Task<IActionResult> Unassign(int tableId, int seatIndex)
    {
        if (UserId is not string uid) return Forbid();
        var assignment = await _db.SeatAssignments
            .FirstOrDefaultAsync(a => a.TableId == tableId && a.SeatIndex == seatIndex && a.UserId == uid);
        if (assignment is null) return NotFound();

        _db.SeatAssignments.Remove(assignment);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ---- venue objects: non-seatable canvas items (dance floor, bar, entrance, …) ----

    [HttpPost("objects")]
    public async Task<ActionResult<SeatingObjectDto>> CreateObject([FromBody] SeatingObjectCreateDto dto)
    {
        if (!ModelState.IsValid || !ObjectTypes.Contains(dto.Type)) return ValidationProblem(ModelState);
        if (UserId is not string uid) return Forbid();

        var obj = new SeatingObject
        {
            UserId = uid,
            Type = dto.Type,
            PositionX = dto.PositionX,
            PositionY = dto.PositionY,
            Width = dto.Width,
            Height = dto.Height,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        _db.SeatingObjects.Add(obj);
        await _db.SaveChangesAsync();

        return Ok(ToDto(obj));
    }

    [HttpPut("objects/{id:int}")]
    public async Task<IActionResult> UpdateObject(int id, [FromBody] SeatingObjectUpdateDto dto)
    {
        if (!ModelState.IsValid || !ObjectTypes.Contains(dto.Type)) return ValidationProblem(ModelState);
        if (UserId is not string uid) return Forbid();

        var obj = await _db.SeatingObjects.FirstOrDefaultAsync(o => o.Id == id && o.UserId == uid);
        if (obj is null) return NotFound();

        obj.Type = dto.Type;
        obj.PositionX = dto.PositionX;
        obj.PositionY = dto.PositionY;
        obj.Width = dto.Width;
        obj.Height = dto.Height;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("objects/{id:int}")]
    public async Task<IActionResult> DeleteObject(int id)
    {
        if (UserId is not string uid) return Forbid();
        var obj = await _db.SeatingObjects.FirstOrDefaultAsync(o => o.Id == id && o.UserId == uid);
        if (obj is null) return NotFound();

        _db.SeatingObjects.Remove(obj);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
