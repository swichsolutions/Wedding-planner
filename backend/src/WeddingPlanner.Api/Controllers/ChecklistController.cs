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
/// The couple's tasks („დავალებები“, BUILD-PLAN B3): by stage, with deadlines, who's doing them and
/// where they open. A new plan starts with the starter list (<see cref="StarterTasks"/>), in the
/// language the couple uses. Shared by both partners.
/// </summary>
[ApiController]
[Route("api/planning/checklist")]
[Authorize(Roles = Roles.Couple)]
public class ChecklistController : ControllerBase
{
    private readonly AppDbContext _db;
    /// <summary>The shared plan this request works on (both partners see the same rows).</summary>
    private readonly CoupleScope _couple;

    public ChecklistController(AppDbContext db, CoupleScope couple)
    {
        _db = db;
        _couple = couple;
    }

    /// <summary>The tasks; an empty plan gets the starter list first (in <paramref name="lang"/>).</summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<ChecklistItemDto>>> List([FromQuery] string? lang)
    {
        if (await _couple.IdAsync() is not int cid) return Forbid();

        if (!await _db.ChecklistItems.AnyAsync(c => c.CoupleId == cid))
        {
            // Two first visits at once (two tabs, both partners) would both seed: serialize on the
            // plan and check again inside.
            await using var tx = await _db.Database.BeginTransactionAsync();
            var lockKey = $"tasks-seed-{cid}";
            await _db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtext({lockKey}))");
            if (!await _db.ChecklistItems.AnyAsync(c => c.CoupleId == cid))
            {
                var en = string.Equals(lang, "en", StringComparison.OrdinalIgnoreCase);
                var now = DateTimeOffset.UtcNow;
                // What the start form already answered starts ticked.
                var plan = await _db.Couples.AsNoTracking().FirstAsync(c => c.Id == cid);
                for (var i = 0; i < StarterTasks.All.Length; i++)
                {
                    var t = StarterTasks.All[i];
                    _db.ChecklistItems.Add(new ChecklistItem
                    {
                        CoupleId = cid,
                        Title = en ? t.En : t.Ka,
                        Stage = t.Stage,
                        Link = t.Link,
                        SortOrder = i,
                        CreatedAt = now,
                        IsDone = (t.Ka == StarterTasks.SetBudget && plan.TotalBudget > 0) || (t.Ka == StarterTasks.ChooseDate && plan.WeddingDate != null),
                    });
                }
                await _db.SaveChangesAsync();
            }
            await tx.CommitAsync();
        }

        var items = await _db.ChecklistItems
            .AsNoTracking()
            .Where(c => c.CoupleId == cid)
            .OrderBy(c => c.SortOrder)
            .Select(c => new ChecklistItemDto(c.Id, c.Title, c.IsDone, c.SortOrder, c.Stage, c.DueDate, c.Who, c.Link, StarterTasks.KaOf(c.Title), StarterTasks.EnOf(c.Title), c.CreatedAt))
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost]
    public async Task<ActionResult<ChecklistItemDto>> Create([FromBody] ChecklistCreateDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (await _couple.IdAsync() is not int cid) return Forbid();

        var maxSort = await _db.ChecklistItems
            .Where(c => c.CoupleId == cid)
            .Select(c => (int?)c.SortOrder)
            .MaxAsync() ?? -1;

        var item = new ChecklistItem
        {
            CoupleId = cid,
            Title = dto.Title.Trim(),
            Stage = StageOrNull(dto.Stage),
            DueDate = dto.DueDate,
            Who = Clean(dto.Who),
            SortOrder = maxSort + 1,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        _db.ChecklistItems.Add(item);
        await _db.SaveChangesAsync();

        return Ok(ToDto(item));
    }

    /// <summary>Save the task as edited (the link of a starter task stays as it was).</summary>
    [HttpPut("{id:int}")]
    public async Task<ActionResult<ChecklistItemDto>> Update(int id, [FromBody] ChecklistUpdateDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (await _couple.IdAsync() is not int cid) return Forbid();
        var item = await _db.ChecklistItems.FirstOrDefaultAsync(c => c.Id == id && c.CoupleId == cid);
        if (item is null) return NotFound();

        item.IsDone = dto.IsDone;
        if (!string.IsNullOrWhiteSpace(dto.Title))
            item.Title = dto.Title.Trim();
        item.Stage = StageOrNull(dto.Stage);
        item.DueDate = dto.DueDate;
        item.Who = Clean(dto.Who);
        await _db.SaveChangesAsync();
        return Ok(ToDto(item));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (await _couple.IdAsync() is not int cid) return Forbid();
        var item = await _db.ChecklistItems.FirstOrDefaultAsync(c => c.Id == id && c.CoupleId == cid);
        if (item is null) return NotFound();

        _db.ChecklistItems.Remove(item);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static ChecklistItemDto ToDto(ChecklistItem c) =>
        new(c.Id, c.Title, c.IsDone, c.SortOrder, c.Stage, c.DueDate, c.Who, c.Link, StarterTasks.KaOf(c.Title), StarterTasks.EnOf(c.Title), c.CreatedAt);

    private static string? StageOrNull(string? stage) =>
        stage is not null && StarterTasks.Stages.Contains(stage.Trim()) ? stage.Trim() : null;

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
