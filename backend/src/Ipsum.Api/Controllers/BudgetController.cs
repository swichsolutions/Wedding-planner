using System.Security.Claims;
using Ipsum.Api.Auth;
using Ipsum.Api.Dtos;
using Ipsum.Domain.Entities;
using Ipsum.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ipsum.Api.Controllers;

/// <summary>
/// The couple's wedding budget — total + line items (estimate / actual / paid), each
/// optionally linked to a directory vendor. Seeded from Georgian wedding norms on first
/// visit; percentages mirror frontend core/budget.ts.
/// </summary>
[ApiController]
[Route("api/planning/budget")]
[Authorize(Roles = Roles.Couple)]
public class BudgetController : ControllerBase
{
    /// <summary>Default budget rows: name (ka), vendor category slug, share of total (sums to 100).</summary>
    private static readonly (string Name, string? CategorySlug, int Pct)[] DefaultItems =
    {
        ("დარბაზი და კვება", "darbazi", 40),
        ("ფოტოგრაფი", "fotografi", 8),
        ("ვიდეოგრაფი", "videografi", 4),
        ("მუსიკა / DJ", "musika", 8),
        ("დეკორი", "dekori", 6),
        ("ფლორისტი", "floristi", 4),
        ("საქორწილო კაბა", "kaba", 5),
        ("კოსტიუმი", "kostiumi", 3),
        ("ბეჭდები", "bechdebi", 5),
        ("მაკიაჟი", "makiaji", 2),
        ("თმის ვარცხნილობა", "tmis-stili", 2),
        ("საქორწილო ტორტი", "torti", 3),
        ("ტრანსპორტი", "transporti", 3),
        ("მოსაწვევები და სხვა", null, 7),
    };

    private readonly AppDbContext _db;

    public BudgetController(AppDbContext db) => _db = db;

    private string? UserId => User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    [HttpGet]
    public async Task<ActionResult<BudgetDto>> Get()
    {
        if (UserId is not string uid) return Forbid();

        var total = await CurrentTotalAsync(uid);

        var hasAny = await _db.BudgetItems.AnyAsync(i => i.UserId == uid);
        if (!hasAny)
        {
            var now = DateTimeOffset.UtcNow;
            for (var i = 0; i < DefaultItems.Length; i++)
            {
                var (name, slug, pct) = DefaultItems[i];
                _db.BudgetItems.Add(new BudgetItem
                {
                    UserId = uid,
                    Name = name,
                    CategorySlug = slug,
                    DefaultPct = pct,
                    Estimate = EstimateFor(total, pct),
                    SortOrder = i,
                    CreatedAt = now,
                });
            }
            await _db.SaveChangesAsync();
        }

        return Ok(new BudgetDto(total, await LoadItemsAsync(uid)));
    }

    /// <summary>
    /// Dated payment reminders, soonest first. Unlike GET /, this never seeds — the
    /// planning page must not create budget rows as a side effect.
    /// </summary>
    [HttpGet("reminders")]
    public async Task<ActionResult<IEnumerable<BudgetReminderDto>>> Reminders()
    {
        if (UserId is not string uid) return Forbid();

        var reminders = await _db.BudgetItems
            .AsNoTracking()
            .Where(i => i.UserId == uid && i.ReminderDate != null)
            .OrderBy(i => i.ReminderDate)
            .Select(i => new BudgetReminderDto(
                i.Id, i.Name, i.ReminderDate!.Value, i.Estimate, i.ActualCost, i.Paid))
            .ToListAsync();

        return Ok(reminders);
    }

    [HttpPut("total")]
    public async Task<ActionResult<BudgetDto>> UpdateTotal([FromBody] BudgetTotalUpdateDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (UserId is not string uid) return Forbid();

        var couple = await _db.Couples.FirstOrDefaultAsync(c => c.UserId == uid);
        if (couple is null)
        {
            // Couple accounts predating onboarding have no profile row yet — create one.
            // Committed on its own so a concurrent first-time save losing the race on
            // the unique Couple.UserId index recovers instead of 500ing.
            var email = await _db.Users.Where(u => u.Id == uid).Select(u => u.Email).FirstOrDefaultAsync();
            couple = new Couple { UserId = uid, Email = email ?? string.Empty, CreatedAt = DateTimeOffset.UtcNow };
            _db.Couples.Add(couple);
            try
            {
                await _db.SaveChangesAsync();
            }
            catch (DbUpdateException ex) when (DbErrors.IsUniqueViolation(ex))
            {
                // The racing request inserted the row first — continue with theirs.
                _db.ChangeTracker.Clear();
                couple = await _db.Couples.FirstAsync(c => c.UserId == uid);
            }
        }
        couple.TotalBudget = dto.TotalBudget;

        if (dto.ResetEstimates)
        {
            // Explicit reset: every seeded row returns to the suggested split.
            var seeded = await _db.BudgetItems
                .Where(i => i.UserId == uid && i.DefaultPct != null)
                .ToListAsync();
            foreach (var item in seeded)
            {
                item.Estimate = EstimateFor(dto.TotalBudget, item.DefaultPct!.Value);
                item.EstimateEdited = false;
            }
        }
        else if (dto.ApplyEstimates)
        {
            // Live follow: only rows the couple hasn't hand-tuned track the total.
            var following = await _db.BudgetItems
                .Where(i => i.UserId == uid && i.DefaultPct != null && !i.EstimateEdited)
                .ToListAsync();
            foreach (var item in following)
                item.Estimate = EstimateFor(dto.TotalBudget, item.DefaultPct!.Value);
        }

        await _db.SaveChangesAsync();
        return Ok(new BudgetDto(dto.TotalBudget, await LoadItemsAsync(uid)));
    }

    [HttpPost("items")]
    public async Task<ActionResult<BudgetItemDto>> CreateItem([FromBody] BudgetItemCreateDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (UserId is not string uid) return Forbid();

        var categorySlug = NormalizeOrNull(dto.CategorySlug);
        if (categorySlug is not null && !await _db.Categories.AnyAsync(c => c.Slug == categorySlug))
            return BadRequest("Unknown category.");

        var maxSort = await _db.BudgetItems
            .Where(i => i.UserId == uid)
            .Select(i => (int?)i.SortOrder)
            .MaxAsync() ?? -1;

        var item = new BudgetItem
        {
            UserId = uid,
            Name = dto.Name.Trim(),
            CategorySlug = categorySlug,
            Estimate = dto.Estimate,
            SortOrder = maxSort + 1,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        _db.BudgetItems.Add(item);
        await _db.SaveChangesAsync();

        return Ok(MapItem(item));
    }

    [HttpPut("items/{id:int}")]
    public async Task<ActionResult<BudgetItemDto>> UpdateItem(int id, [FromBody] BudgetItemUpdateDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (UserId is not string uid) return Forbid();

        var item = await _db.BudgetItems
            .Include(i => i.Vendor).ThenInclude(v => v!.Category)
            .FirstOrDefaultAsync(i => i.Id == id && i.UserId == uid);
        if (item is null) return NotFound();

        // Validate only when the link is changing — an already-linked vendor that was later
        // unapproved must not block unrelated edits (name, amounts, note) to the row.
        if (dto.VendorId is int vendorId && vendorId != item.VendorId)
        {
            var vendorOk = await _db.Vendors.AnyAsync(v => v.Id == vendorId && v.IsApproved);
            if (!vendorOk) return BadRequest("Unknown vendor.");
        }

        // A hand-typed estimate detaches the row from the suggested split (until reset).
        if (item.DefaultPct != null && dto.Estimate != item.Estimate)
            item.EstimateEdited = true;

        item.Name = dto.Name.Trim();
        item.VendorId = dto.VendorId;
        // A row points at a directory vendor OR a free-text merchant, never both.
        item.MerchantName = dto.VendorId is null ? NormalizeOrNull(dto.MerchantName) : null;
        item.Estimate = dto.Estimate;
        item.ActualCost = dto.ActualCost;
        item.Paid = dto.Paid;
        item.Note = NormalizeOrNull(dto.Note);
        item.ReminderDate = dto.ReminderDate;
        await _db.SaveChangesAsync();

        // Re-read the vendor ref so a newly-linked vendor comes back fully populated.
        if (item.VendorId is not null)
            await _db.Entry(item).Reference(i => i.Vendor).Query().Include(v => v.Category).LoadAsync();

        return Ok(MapItem(item));
    }

    /// <summary>Rewrite display order. ("items/order" is literal, so no clash with items/{id:int}.)</summary>
    [HttpPut("items/order")]
    public async Task<IActionResult> Reorder([FromBody] BudgetReorderDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (UserId is not string uid) return Forbid();

        var items = await _db.BudgetItems.Where(i => i.UserId == uid).ToListAsync();
        var byId = items.ToDictionary(i => i.Id);

        // Must be a permutation of the couple's items — a stale list (e.g. another tab
        // added a row) is rejected; the client resyncs.
        if (dto.ItemIds.Count != items.Count
            || dto.ItemIds.Distinct().Count() != dto.ItemIds.Count
            || dto.ItemIds.Any(id => !byId.ContainsKey(id)))
        {
            return BadRequest("Order must include every budget item exactly once.");
        }

        for (var i = 0; i < dto.ItemIds.Count; i++)
            byId[dto.ItemIds[i]].SortOrder = i;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("items/{id:int}")]
    public async Task<IActionResult> DeleteItem(int id)
    {
        if (UserId is not string uid) return Forbid();
        var item = await _db.BudgetItems.FirstOrDefaultAsync(i => i.Id == id && i.UserId == uid);
        if (item is null) return NotFound();

        _db.BudgetItems.Remove(item);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private async Task<decimal?> CurrentTotalAsync(string uid) =>
        await _db.Couples
            .AsNoTracking()
            .Where(c => c.UserId == uid)
            .Select(c => c.TotalBudget)
            .FirstOrDefaultAsync();

    private async Task<List<BudgetItemDto>> LoadItemsAsync(string uid)
    {
        var items = await _db.BudgetItems
            .AsNoTracking()
            .Include(i => i.Vendor).ThenInclude(v => v!.Category)
            .Where(i => i.UserId == uid)
            .OrderBy(i => i.SortOrder)
            .ToListAsync();
        return items.Select(MapItem).ToList();
    }

    private static BudgetItemDto MapItem(BudgetItem i) =>
        new(
            i.Id,
            i.Name,
            i.CategorySlug,
            i.Vendor is null
                ? null
                : new BudgetVendorRefDto(i.Vendor.Id, i.Vendor.Name, i.Vendor.Category.Slug, i.Vendor.CitySlug, i.Vendor.Slug),
            i.MerchantName,
            i.Estimate,
            i.ActualCost,
            i.Paid,
            i.Note,
            i.ReminderDate,
            i.SortOrder);

    private static decimal? EstimateFor(decimal? total, int pct) =>
        total is decimal t && t > 0 ? Math.Round(t * pct / 100) : null;

    private static string? NormalizeOrNull(string? s)
    {
        var trimmed = s?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }
}
