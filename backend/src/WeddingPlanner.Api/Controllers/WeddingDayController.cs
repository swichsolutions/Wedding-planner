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
/// „ქორწილის დღე“ (BUILD-PLAN B2, guide §7): the couple's own wedding-day schedule, shared by both
/// partners. Activities come back in time order; a schedule can start from one of the examples
/// (/ganrigebi sends its rows) or blank.
/// </summary>
[ApiController]
[Route("api/planning/day")]
[Authorize(Roles = Roles.Couple)]
public class WeddingDayController : ControllerBase
{
    /// <summary>Plenty for one day; keeps a runaway client from filling the table.</summary>
    private const int MaxItems = 100;

    private readonly AppDbContext _db;
    private readonly CoupleScope _couple;

    public WeddingDayController(AppDbContext db, CoupleScope couple)
    {
        _db = db;
        _couple = couple;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<WeddingDayItemDto>>> List()
    {
        if (await _couple.IdAsync() is not int cid) return Forbid();
        return Ok(await LoadAsync(cid));
    }

    [HttpPost]
    public async Task<ActionResult<WeddingDayItemDto>> Create([FromBody] WeddingDayItemEditDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (await _couple.IdAsync() is not int cid) return Forbid();
        if (await _db.WeddingDayItems.CountAsync(i => i.CoupleId == cid) >= MaxItems)
            return Conflict(new { code = "full" });

        var maxSort = await _db.WeddingDayItems.Where(i => i.CoupleId == cid)
            .Select(i => (int?)i.SortOrder).MaxAsync() ?? -1;
        var item = new WeddingDayItem { CoupleId = cid, SortOrder = maxSort + 1 };
        Apply(item, dto);
        _db.WeddingDayItems.Add(item);
        await _db.SaveChangesAsync();
        return Ok(ToDto(item));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<WeddingDayItemDto>> Update(int id, [FromBody] WeddingDayItemEditDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (await _couple.IdAsync() is not int cid) return Forbid();
        var item = await _db.WeddingDayItems.FirstOrDefaultAsync(i => i.Id == id && i.CoupleId == cid);
        if (item is null) return NotFound();
        Apply(item, dto);
        await _db.SaveChangesAsync();
        return Ok(ToDto(item));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (await _couple.IdAsync() is not int cid) return Forbid();
        var deleted = await _db.WeddingDayItems.Where(i => i.Id == id && i.CoupleId == cid).ExecuteDeleteAsync();
        return deleted == 0 ? NotFound() : NoContent();
    }

    /// <summary>Start over: removes every activity.</summary>
    [HttpDelete]
    public async Task<IActionResult> Clear()
    {
        if (await _couple.IdAsync() is not int cid) return Forbid();
        await _db.WeddingDayItems.Where(i => i.CoupleId == cid).ExecuteDeleteAsync();
        return NoContent();
    }

    /// <summary>The order among activities at the same time (the list's ids, top to bottom).</summary>
    [HttpPut("order")]
    public async Task<IActionResult> Reorder([FromBody] WeddingDayOrderDto dto)
    {
        if (await _couple.IdAsync() is not int cid) return Forbid();
        var items = await _db.WeddingDayItems.Where(i => i.CoupleId == cid).ToListAsync();
        for (var i = 0; i < dto.Ids.Length; i++)
        {
            var item = items.FirstOrDefault(x => x.Id == dto.Ids[i]);
            if (item is not null) item.SortOrder = i;
        }
        await _db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>„გამოიყენე ეს განრიგი“: add an example's rows, or replace the schedule with them.</summary>
    [HttpPost("template")]
    public async Task<ActionResult<IEnumerable<WeddingDayItemDto>>> UseTemplate([FromBody] WeddingDayTemplateDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (await _couple.IdAsync() is not int cid) return Forbid();

        await using var tx = await _db.Database.BeginTransactionAsync();
        if (dto.Replace)
            await _db.WeddingDayItems.Where(i => i.CoupleId == cid).ExecuteDeleteAsync();

        var existing = await _db.WeddingDayItems.Where(i => i.CoupleId == cid).ToListAsync();
        if (existing.Count + dto.Rows.Count > MaxItems) return Conflict(new { code = "full" });

        var sort = existing.Count == 0 ? 0 : existing.Max(i => i.SortOrder) + 1;
        foreach (var row in dto.Rows)
        {
            var item = new WeddingDayItem { CoupleId = cid, SortOrder = sort++ };
            Apply(item, row);
            _db.WeddingDayItems.Add(item);
        }
        await _db.SaveChangesAsync();
        await tx.CommitAsync();
        return Ok(await LoadAsync(cid));
    }

    // ------------------------------------------------------------------ helpers

    private async Task<List<WeddingDayItemDto>> LoadAsync(int cid)
    {
        var items = await _db.WeddingDayItems.AsNoTracking().Where(i => i.CoupleId == cid).ToListAsync();
        return items
            .OrderBy(i => TimeKey(i.Time))
            .ThenBy(i => i.SortOrder)
            .Select(ToDto)
            .ToList();
    }

    /// <summary>
    /// Minutes into the wedding day: hours before 05:00 belong after midnight (the "00:00 end"
    /// comes after "23:30 cake"); activities without a time go last.
    /// </summary>
    public static int TimeKey(string? time)
    {
        if (time is null || time.Length != 5) return int.MaxValue;
        var h = int.Parse(time[..2]);
        var m = int.Parse(time[3..]);
        return (h < 5 ? h + 24 : h) * 60 + m;
    }

    private static void Apply(WeddingDayItem item, WeddingDayItemEditDto dto)
    {
        item.Time = Clean(dto.Time);
        item.Activity = dto.Activity.Trim();
        item.Note = Clean(dto.Note);
        item.Who = Clean(dto.Who);
        item.Contact = Clean(dto.Contact);
    }

    private static WeddingDayItemDto ToDto(WeddingDayItem i) =>
        new(i.Id, i.Time, i.Activity, i.Note, i.Who, i.Contact, i.SortOrder);

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
