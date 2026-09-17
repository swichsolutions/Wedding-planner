using System.Security.Claims;
using WeddingPlanner.Api.Auth;
using WeddingPlanner.Api.Dtos;
using WeddingPlanner.Domain.Entities;
using WeddingPlanner.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace WeddingPlanner.Api.Controllers;

[ApiController]
[Route("api/planning/checklist")]
[Authorize(Roles = Roles.Couple)]
public class ChecklistController : ControllerBase
{
    // Default Georgian wedding-planning tasks seeded for a new couple.
    private static readonly string[] DefaultTasks =
    {
        "დაადგინეთ ქორწილის თარიღი",
        "განსაზღვრეთ ბიუჯეტი",
        "შეადგინეთ სტუმრების სია",
        "დაჯავშნეთ დარბაზი",
        "აირჩიეთ ფოტოგრაფი და ვიდეოგრაფი",
        "შეარჩიეთ დეკორი და ფლორისტი",
        "აირჩიეთ მუსიკა ან DJ",
        "შეუკვეთეთ ტორტი",
        "შეარჩიეთ კაბა და კოსტიუმი",
        "გააგზავნეთ მოწვევები",
    };

    private readonly AppDbContext _db;

    public ChecklistController(AppDbContext db) => _db = db;

    private string? UserId => User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ChecklistItemDto>>> List()
    {
        if (UserId is not string uid) return Forbid();

        var hasAny = await _db.ChecklistItems.AnyAsync(c => c.UserId == uid);
        if (!hasAny)
        {
            var now = DateTimeOffset.UtcNow;
            for (var i = 0; i < DefaultTasks.Length; i++)
            {
                _db.ChecklistItems.Add(new ChecklistItem
                {
                    UserId = uid,
                    Title = DefaultTasks[i],
                    SortOrder = i,
                    CreatedAt = now,
                });
            }
            await _db.SaveChangesAsync();
        }

        var items = await _db.ChecklistItems
            .AsNoTracking()
            .Where(c => c.UserId == uid)
            .OrderBy(c => c.SortOrder)
            .Select(c => new ChecklistItemDto(c.Id, c.Title, c.IsDone, c.SortOrder))
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost]
    public async Task<ActionResult<ChecklistItemDto>> Create([FromBody] ChecklistCreateDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (UserId is not string uid) return Forbid();

        var maxSort = await _db.ChecklistItems
            .Where(c => c.UserId == uid)
            .Select(c => (int?)c.SortOrder)
            .MaxAsync() ?? -1;

        var item = new ChecklistItem
        {
            UserId = uid,
            Title = dto.Title.Trim(),
            SortOrder = maxSort + 1,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        _db.ChecklistItems.Add(item);
        await _db.SaveChangesAsync();

        return Ok(new ChecklistItemDto(item.Id, item.Title, item.IsDone, item.SortOrder));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] ChecklistUpdateDto dto)
    {
        if (UserId is not string uid) return Forbid();
        var item = await _db.ChecklistItems.FirstOrDefaultAsync(c => c.Id == id && c.UserId == uid);
        if (item is null) return NotFound();

        item.IsDone = dto.IsDone;
        if (!string.IsNullOrWhiteSpace(dto.Title))
            item.Title = dto.Title.Trim();
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (UserId is not string uid) return Forbid();
        var item = await _db.ChecklistItems.FirstOrDefaultAsync(c => c.Id == id && c.UserId == uid);
        if (item is null) return NotFound();

        _db.ChecklistItems.Remove(item);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
