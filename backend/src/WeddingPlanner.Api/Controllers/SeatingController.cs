using WeddingPlanner.Api.Auth;
using WeddingPlanner.Api.Dtos;
using WeddingPlanner.Api.Planning;
using WeddingPlanner.Domain.Entities;
using WeddingPlanner.Infrastructure.Data;
using WeddingPlanner.Infrastructure.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace WeddingPlanner.Api.Controllers;

/// <summary>The couple's seating chart: tables (free-form canvas position, shape,
/// seat count, rotation) and per-seat attendee assignments, venue items (zones), and the
/// venue's floor plan underneath. Never auto-seeds — starts empty, same as the guest list.</summary>
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

    private const long MaxPlanBytes = 8 * 1024 * 1024; // 8 MB
    private static readonly string[] AllowedPlanTypes = { "image/jpeg", "image/png", "image/webp" };

    private readonly AppDbContext _db;
    /// <summary>The shared plan this request works on (both partners see the same rows).</summary>
    private readonly CoupleScope _couple;
    private readonly IPhotoStorage _storage;
    private readonly ILogger<SeatingController> _logger;

    public SeatingController(AppDbContext db, CoupleScope couple, IPhotoStorage storage, ILogger<SeatingController> logger)
    {
        _db = db;
        _couple = couple;
        _storage = storage;
        _logger = logger;
    }

    private static SeatingTableDto ToDto(SeatingTable t) =>
        new(t.Id, t.Name, t.Shape, t.SeatCount, t.PositionX, t.PositionY, t.Rotation);

    private static SeatAssignmentDto ToDto(SeatAssignment a) =>
        new(a.TableId, a.SeatIndex, a.GuestId, a.AttendeeKind);

    private static SeatingObjectDto ToDto(SeatingObject o) =>
        new(o.Id, o.Type, o.PositionX, o.PositionY, o.Width, o.Height, o.Rotation, o.Label);

    /// <summary>0 ≤ degrees &lt; 360.</summary>
    private static double Turn(double degrees) => ((degrees % 360) + 360) % 360;

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    [HttpGet]
    public async Task<ActionResult<SeatingStateDto>> Get()
    {
        if (await _couple.IdAsync() is not int cid) return Forbid();

        var tables = await _db.SeatingTables.AsNoTracking().Where(t => t.CoupleId == cid).ToListAsync();
        var assignments = await _db.SeatAssignments.AsNoTracking().Where(a => a.CoupleId == cid).ToListAsync();
        var objects = await _db.SeatingObjects.AsNoTracking().Where(o => o.CoupleId == cid).ToListAsync();
        var plan = await _db.Couples.AsNoTracking().Where(c => c.Id == cid).Select(c => c.FloorPlanUrl).FirstOrDefaultAsync();

        return Ok(new SeatingStateDto(tables.Select(ToDto), assignments.Select(ToDto), objects.Select(ToDto), plan));
    }

    [HttpPost("tables")]
    public async Task<ActionResult<SeatingTableDto>> CreateTable([FromBody] SeatingTableCreateDto dto)
    {
        if (!ModelState.IsValid || !Shapes.Contains(dto.Shape)) return ValidationProblem(ModelState);
        if (await _couple.IdAsync() is not int cid) return Forbid();

        var table = new SeatingTable
        {
            CoupleId = cid,
            Name = dto.Name.Trim(),
            Shape = dto.Shape,
            SeatCount = dto.SeatCount,
            PositionX = dto.PositionX,
            PositionY = dto.PositionY,
            Rotation = Turn(dto.Rotation),
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
        if (await _couple.IdAsync() is not int cid) return Forbid();

        var table = await _db.SeatingTables.FirstOrDefaultAsync(t => t.Id == id && t.CoupleId == cid);
        if (table is null) return NotFound();

        table.Name = dto.Name.Trim();
        table.Shape = dto.Shape;
        table.SeatCount = dto.SeatCount;
        table.PositionX = dto.PositionX;
        table.PositionY = dto.PositionY;
        table.Rotation = Turn(dto.Rotation);

        // Shrinking the seat count orphans any assignment that no longer fits.
        var overflow = _db.SeatAssignments.Where(a => a.TableId == id && a.SeatIndex >= dto.SeatCount);
        _db.SeatAssignments.RemoveRange(overflow);

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("tables/{id:int}")]
    public async Task<IActionResult> DeleteTable(int id)
    {
        if (await _couple.IdAsync() is not int cid) return Forbid();
        var table = await _db.SeatingTables.FirstOrDefaultAsync(t => t.Id == id && t.CoupleId == cid);
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
        if (await _couple.IdAsync() is not int cid) return Forbid();

        var table = await _db.SeatingTables.FirstOrDefaultAsync(t => t.Id == dto.TableId && t.CoupleId == cid);
        if (table is null) return NotFound();
        if (dto.SeatIndex < 0 || dto.SeatIndex >= table.SeatCount) return BadRequest();

        var guest = await _db.Guests.FirstOrDefaultAsync(g => g.Id == dto.GuestId && g.CoupleId == cid);
        if (guest is null) return NotFound();
        if (guest.Attendance == "no") return Conflict(new { code = "declined" });

        var existing = _db.SeatAssignments.Where(a => a.CoupleId == cid &&
            ((a.TableId == dto.TableId && a.SeatIndex == dto.SeatIndex) ||
             (a.GuestId == dto.GuestId && a.AttendeeKind == dto.AttendeeKind)));
        _db.SeatAssignments.RemoveRange(existing);

        _db.SeatAssignments.Add(new SeatAssignment
        {
            CoupleId = cid,
            TableId = dto.TableId,
            SeatIndex = dto.SeatIndex,
            GuestId = dto.GuestId,
            AttendeeKind = dto.AttendeeKind,
        });
        await _db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// Seat a guest's whole party (the guest, plus-one, child) at one table, in its free seats in
    /// order (the guest list's table picker). TableId null unseats the party. 409 "full" when the
    /// table hasn't enough free seats; nothing changes then.
    /// </summary>
    [HttpPut("seat-guest")]
    public async Task<ActionResult<IEnumerable<SeatAssignmentDto>>> SeatGuest([FromBody] SeatGuestDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (await _couple.IdAsync() is not int cid) return Forbid();
        var guest = await _db.Guests.FirstOrDefaultAsync(g => g.Id == dto.GuestId && g.CoupleId == cid);
        if (guest is null) return NotFound();

        await using var tx = await _db.Database.BeginTransactionAsync();
        var mine = await _db.SeatAssignments.Where(a => a.GuestId == guest.Id).ToListAsync();
        if (dto.TableId is not int tableId)
        {
            _db.SeatAssignments.RemoveRange(mine);
            await _db.SaveChangesAsync();
            await tx.CommitAsync();
            return Ok(Array.Empty<SeatAssignmentDto>());
        }

        if (guest.Attendance == "no") return Conflict(new { code = "declined" });
        var table = await _db.SeatingTables.FirstOrDefaultAsync(t => t.Id == tableId && t.CoupleId == cid);
        if (table is null) return NotFound();

        var kinds = new List<string> { "primary" };
        if (guest.HasPlusOne) kinds.Add("plus_one");
        if (guest.HasChild) kinds.Add("child");

        // Those already at this table keep their seats; the rest take the first free ones.
        var taken = await _db.SeatAssignments
            .Where(a => a.TableId == tableId && a.GuestId != guest.Id)
            .Select(a => a.SeatIndex)
            .ToListAsync();
        var keep = mine.Where(a => a.TableId == tableId && kinds.Contains(a.AttendeeKind)).ToList();
        var free = Enumerable.Range(0, table.SeatCount)
            .Where(i => !taken.Contains(i) && !keep.Any(k => k.SeatIndex == i))
            .ToList();
        var toSeat = kinds.Where(k => !keep.Any(a => a.AttendeeKind == k)).ToList();
        if (free.Count < toSeat.Count) return Conflict(new { code = "full", free = free.Count, needed = toSeat.Count });

        _db.SeatAssignments.RemoveRange(mine.Except(keep));
        await _db.SaveChangesAsync();
        for (var i = 0; i < toSeat.Count; i++)
        {
            _db.SeatAssignments.Add(new SeatAssignment
            {
                CoupleId = cid,
                TableId = tableId,
                SeatIndex = free[i],
                GuestId = guest.Id,
                AttendeeKind = toSeat[i],
            });
        }
        await _db.SaveChangesAsync();
        await tx.CommitAsync();

        var now = await _db.SeatAssignments.AsNoTracking().Where(a => a.GuestId == guest.Id).ToListAsync();
        return Ok(now.Select(ToDto));
    }

    [HttpDelete("assign/{tableId:int}/{seatIndex:int}")]
    public async Task<IActionResult> Unassign(int tableId, int seatIndex)
    {
        if (await _couple.IdAsync() is not int cid) return Forbid();
        var assignment = await _db.SeatAssignments
            .FirstOrDefaultAsync(a => a.TableId == tableId && a.SeatIndex == seatIndex && a.CoupleId == cid);
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
        if (await _couple.IdAsync() is not int cid) return Forbid();

        var obj = new SeatingObject
        {
            CoupleId = cid,
            Type = dto.Type,
            PositionX = dto.PositionX,
            PositionY = dto.PositionY,
            Width = dto.Width,
            Height = dto.Height,
            Rotation = Turn(dto.Rotation),
            Label = Clean(dto.Label),
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
        if (await _couple.IdAsync() is not int cid) return Forbid();

        var obj = await _db.SeatingObjects.FirstOrDefaultAsync(o => o.Id == id && o.CoupleId == cid);
        if (obj is null) return NotFound();

        obj.Type = dto.Type;
        obj.PositionX = dto.PositionX;
        obj.PositionY = dto.PositionY;
        obj.Width = dto.Width;
        obj.Height = dto.Height;
        obj.Rotation = Turn(dto.Rotation);
        obj.Label = Clean(dto.Label);

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("objects/{id:int}")]
    public async Task<IActionResult> DeleteObject(int id)
    {
        if (await _couple.IdAsync() is not int cid) return Forbid();
        var obj = await _db.SeatingObjects.FirstOrDefaultAsync(o => o.Id == id && o.CoupleId == cid);
        if (obj is null) return NotFound();

        _db.SeatingObjects.Remove(obj);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ---- the venue's floor plan: an image under the chart ----

    [HttpPost("floor-plan")]
    [RequestSizeLimit(MaxPlanBytes + 1024)]
    public async Task<ActionResult<SeatingStateDto>> UploadFloorPlan(IFormFile? file)
    {
        if (await _couple.IdAsync() is not int cid) return Forbid();
        if (file is null || file.Length == 0) return BadRequest("No file provided.");
        if (file.Length > MaxPlanBytes) return BadRequest("File too large (max 8 MB).");
        if (!AllowedPlanTypes.Contains(file.ContentType))
            return BadRequest("Unsupported file type. Use JPG, PNG, or WebP.");

        // Content-Type and filename are client-controlled; only the magic bytes decide.
        string? ext;
        await using (var sniff = file.OpenReadStream())
        {
            ext = await ImageSniffer.DetectExtensionAsync(sniff);
        }
        if (ext is null) return BadRequest("Unsupported file type. Use JPG, PNG, or WebP.");

        StoredPhoto stored;
        await using (var stream = file.OpenReadStream())
        {
            stored = await _storage.UploadAsync(stream, $"floorplan{ext}");
        }

        var plan = await _db.Couples.FirstAsync(c => c.Id == cid);
        var old = plan.FloorPlanStorageId;
        plan.FloorPlanUrl = stored.Url;
        plan.FloorPlanStorageId = stored.StorageId;
        await _db.SaveChangesAsync();
        // The old image goes only after the new one is saved.
        await TryDeleteBlobAsync(old);
        return await Get();
    }

    [HttpDelete("floor-plan")]
    public async Task<ActionResult<SeatingStateDto>> RemoveFloorPlan()
    {
        if (await _couple.IdAsync() is not int cid) return Forbid();
        var plan = await _db.Couples.FirstAsync(c => c.Id == cid);
        var old = plan.FloorPlanStorageId;
        plan.FloorPlanUrl = null;
        plan.FloorPlanStorageId = null;
        await _db.SaveChangesAsync();
        await TryDeleteBlobAsync(old);
        return await Get();
    }

    private async Task TryDeleteBlobAsync(string? storageId)
    {
        if (string.IsNullOrEmpty(storageId)) return;
        try
        {
            await _storage.DeleteAsync(storageId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Orphaned floor-plan blob {StorageId} could not be deleted.", storageId);
        }
    }
}
