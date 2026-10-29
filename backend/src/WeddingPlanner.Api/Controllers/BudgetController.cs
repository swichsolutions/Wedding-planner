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
    /// <summary>The shared plan this request works on (both partners see the same rows).</summary>
    private readonly CoupleScope _couple;

    public BudgetController(AppDbContext db, CoupleScope couple)
    {
        _db = db;
        _couple = couple;
    }

    [HttpGet]
    public async Task<ActionResult<BudgetDto>> Get()
    {
        if (await _couple.IdAsync() is not int cid) return Forbid();

        var total = await CurrentTotalAsync(cid);

        var hasAny = await _db.BudgetItems.AnyAsync(i => i.CoupleId == cid);
        if (!hasAny)
        {
            // Two concurrent first visits (two tabs) would both pass the check above and
            // seed 28 rows. A unique index on (CoupleId, SortOrder) can't guard this —
            // reorders would violate it transiently — so serialize the seed with a
            // per-plan advisory lock and re-check inside it.
            await using var tx = await _db.Database.BeginTransactionAsync();
            var lockKey = $"budget-seed-{cid}";
            await _db.Database.ExecuteSqlInterpolatedAsync(
                $"SELECT pg_advisory_xact_lock(hashtext({lockKey}))");

            if (!await _db.BudgetItems.AnyAsync(i => i.CoupleId == cid))
            {
                // Seed only what the couple said they'll need at sign-up (plus the
                // categoryless "invitations and other" catch-all) — a couple who skipped
                // that step (empty list) still gets the full comprehensive default.
                var neededCategories = await _db.Couples.AsNoTracking()
                    .Where(c => c.Id == cid)
                    .Select(c => c.NeededCategories)
                    .FirstOrDefaultAsync();
                var toSeed = neededCategories is { Count: > 0 }
                    ? DefaultItems.Where(d => d.CategorySlug is null || neededCategories.Contains(d.CategorySlug)).ToArray()
                    : DefaultItems;

                var now = DateTimeOffset.UtcNow;
                for (var i = 0; i < toSeed.Length; i++)
                {
                    var (name, slug, pct) = toSeed[i];
                    _db.BudgetItems.Add(new BudgetItem
                    {
                        CoupleId = cid,
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

            await tx.CommitAsync();
        }

        return Ok(new BudgetDto(total, await LoadItemsAsync(cid)));
    }

    /// <summary>
    /// Dated payment reminders, soonest first. Unlike GET /, this never seeds — the
    /// planning page must not create budget rows as a side effect. A line paid in full has
    /// nothing left to remind about, so it drops out (its date stays on the line).
    /// </summary>
    [HttpGet("reminders")]
    public async Task<ActionResult<IEnumerable<BudgetReminderDto>>> Reminders()
    {
        if (await _couple.IdAsync() is not int cid) return Forbid();

        var reminders = await _db.BudgetItems
            .AsNoTracking()
            .Where(i => i.CoupleId == cid && i.ReminderDate != null)
            .Where(i => !(i.ActualCost > 0 && i.Paid >= i.ActualCost))
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
        if (await _couple.IdAsync() is not int cid) return Forbid();

        // The plan row always exists: CoupleScope starts one the first time.
        var couple = await _db.Couples.FirstAsync(c => c.Id == cid);
        couple.TotalBudget = dto.TotalBudget;

        if (dto.ResetEstimates)
        {
            // Explicit reset: every seeded row returns to the suggested split.
            var seeded = await _db.BudgetItems
                .Where(i => i.CoupleId == cid && i.DefaultPct != null)
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
                .Where(i => i.CoupleId == cid && i.DefaultPct != null && !i.EstimateEdited)
                .ToListAsync();
            foreach (var item in following)
                item.Estimate = EstimateFor(dto.TotalBudget, item.DefaultPct!.Value);
        }

        await _db.SaveChangesAsync();
        return Ok(new BudgetDto(dto.TotalBudget, await LoadItemsAsync(cid)));
    }

    [HttpPost("items")]
    public async Task<ActionResult<BudgetItemDto>> CreateItem([FromBody] BudgetItemCreateDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (await _couple.IdAsync() is not int cid) return Forbid();

        var categorySlug = NormalizeOrNull(dto.CategorySlug);
        if (categorySlug is not null && !await _db.Categories.AnyAsync(c => c.Slug == categorySlug))
            return BadRequest("Unknown category.");

        if (dto.VendorId is int vendorId && !await _db.Vendors.AnyAsync(v => v.Id == vendorId && v.IsApproved))
            return BadRequest("Unknown vendor.");

        var maxSort = await _db.BudgetItems
            .Where(i => i.CoupleId == cid)
            .Select(i => (int?)i.SortOrder)
            .MaxAsync() ?? -1;

        var item = new BudgetItem
        {
            CoupleId = cid,
            Name = dto.Name.Trim(),
            CategorySlug = categorySlug,
            Estimate = dto.Estimate,
            VendorId = dto.VendorId,
            SortOrder = maxSort + 1,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        _db.BudgetItems.Add(item);
        await _db.SaveChangesAsync();

        if (item.VendorId is not null)
            await _db.Entry(item).Reference(i => i.Vendor).Query().Include(v => v.Category).LoadAsync();

        return Ok(MapItem(item));
    }

    [HttpPut("items/{id:int}")]
    public async Task<ActionResult<BudgetItemDto>> UpdateItem(int id, [FromBody] BudgetItemUpdateDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (await _couple.IdAsync() is not int cid) return Forbid();

        var item = await _db.BudgetItems
            .Include(i => i.Vendor).ThenInclude(v => v!.Category)
            .Include(i => i.Payments)
            .FirstOrDefaultAsync(i => i.Id == id && i.CoupleId == cid);
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
        // Paid isn't edited here: it's the sum of the line's payments (POST items/{id}/payments).
        item.Note = NormalizeOrNull(dto.Note);
        item.ReminderDate = dto.ReminderDate;
        await _db.SaveChangesAsync();

        // Re-read the vendor ref so a newly-linked vendor comes back fully populated.
        if (item.VendorId is not null)
            await _db.Entry(item).Reference(i => i.Vendor).Query().Include(v => v.Category).LoadAsync();

        return Ok(MapItem(item));
    }

    /// <summary>
    /// Record a payment on a line („აფიქსირებს გადახდას“, B4): a deposit, an instalment or the rest.
    /// The line's Paid becomes the sum of its payments.
    /// </summary>
    [HttpPost("items/{id:int}/payments")]
    public async Task<ActionResult<BudgetItemDto>> AddPayment(int id, [FromBody] BudgetPaymentCreateDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (await _couple.IdAsync() is not int cid) return Forbid();
        var item = await LoadTrackedAsync(cid, id);
        if (item is null) return NotFound();
        if (item.Payments.Count >= 50) return Conflict(new { code = "full" });

        item.Payments.Add(new BudgetPayment
        {
            Amount = dto.Amount,
            PaidOn = dto.PaidOn ?? DateOnly.FromDateTime(DateTime.UtcNow),
            Note = NormalizeOrNull(dto.Note),
            CreatedAt = DateTimeOffset.UtcNow,
        });
        item.Paid = item.Payments.Sum(p => p.Amount);
        await _db.SaveChangesAsync();
        return Ok(MapItem(item));
    }

    [HttpDelete("items/{id:int}/payments/{paymentId:int}")]
    public async Task<ActionResult<BudgetItemDto>> DeletePayment(int id, int paymentId)
    {
        if (await _couple.IdAsync() is not int cid) return Forbid();
        var item = await LoadTrackedAsync(cid, id);
        var payment = item?.Payments.FirstOrDefault(p => p.Id == paymentId);
        if (item is null || payment is null) return NotFound();

        item.Payments.Remove(payment);
        _db.BudgetPayments.Remove(payment);
        item.Paid = item.Payments.Count == 0 ? null : item.Payments.Sum(p => p.Amount);
        await _db.SaveChangesAsync();
        return Ok(MapItem(item));
    }

    private Task<BudgetItem?> LoadTrackedAsync(int cid, int id) =>
        _db.BudgetItems
            .Include(i => i.Vendor).ThenInclude(v => v!.Category)
            .Include(i => i.Payments)
            .FirstOrDefaultAsync(i => i.Id == id && i.CoupleId == cid);

    /// <summary>Rewrite display order. ("items/order" is literal, so no clash with items/{id:int}.)</summary>
    [HttpPut("items/order")]
    public async Task<IActionResult> Reorder([FromBody] BudgetReorderDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (await _couple.IdAsync() is not int cid) return Forbid();

        var items = await _db.BudgetItems.Where(i => i.CoupleId == cid).ToListAsync();
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
        if (await _couple.IdAsync() is not int cid) return Forbid();
        var item = await _db.BudgetItems.FirstOrDefaultAsync(i => i.Id == id && i.CoupleId == cid);
        if (item is null) return NotFound();

        _db.BudgetItems.Remove(item);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ---- per-category target budgets (guided planner's scoped calculator) ----

    [HttpGet("category-budgets")]
    public async Task<ActionResult<IEnumerable<CategoryBudgetDto>>> GetCategoryBudgets()
    {
        if (await _couple.IdAsync() is not int cid) return Forbid();
        var list = await _db.CategoryBudgets
            .AsNoTracking()
            .Where(c => c.CoupleId == cid)
            .Select(c => new CategoryBudgetDto(c.CategorySlug, c.Amount))
            .ToListAsync();
        return Ok(list);
    }

    [HttpPut("category-budgets/{categorySlug}")]
    public async Task<ActionResult<CategoryBudgetDto>> SetCategoryBudget(
        string categorySlug, [FromBody] CategoryBudgetUpsertDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (await _couple.IdAsync() is not int cid) return Forbid();

        var row = await _db.CategoryBudgets
            .FirstOrDefaultAsync(c => c.CoupleId == cid && c.CategorySlug == categorySlug);
        if (row is null)
        {
            row = new CategoryBudget { CoupleId = cid, CategorySlug = categorySlug, Amount = dto.Amount };
            _db.CategoryBudgets.Add(row);
        }
        else
        {
            row.Amount = dto.Amount;
        }
        await _db.SaveChangesAsync();
        return Ok(new CategoryBudgetDto(row.CategorySlug, row.Amount));
    }

    [HttpDelete("category-budgets/{categorySlug}")]
    public async Task<IActionResult> ClearCategoryBudget(string categorySlug)
    {
        if (await _couple.IdAsync() is not int cid) return Forbid();
        var row = await _db.CategoryBudgets
            .FirstOrDefaultAsync(c => c.CoupleId == cid && c.CategorySlug == categorySlug);
        if (row is null) return NotFound();

        _db.CategoryBudgets.Remove(row);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private async Task<decimal?> CurrentTotalAsync(int cid) =>
        await _db.Couples
            .AsNoTracking()
            .Where(c => c.Id == cid)
            .Select(c => c.TotalBudget)
            .FirstOrDefaultAsync();

    private async Task<List<BudgetItemDto>> LoadItemsAsync(int cid)
    {
        var items = await _db.BudgetItems
            .AsNoTracking()
            .Include(i => i.Vendor).ThenInclude(v => v!.Category)
            .Include(i => i.Payments)
            .AsSplitQuery()
            .Where(i => i.CoupleId == cid)
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
            i.SortOrder,
            i.Payments.OrderBy(p => p.PaidOn).ThenBy(p => p.Id)
                .Select(p => new BudgetPaymentDto(p.Id, p.Amount, p.PaidOn, p.Note))
                .ToList());

    private static decimal? EstimateFor(decimal? total, int pct) =>
        total is decimal t && t > 0 ? Math.Round(t * pct / 100) : null;

    private static string? NormalizeOrNull(string? s)
    {
        var trimmed = s?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }
}
