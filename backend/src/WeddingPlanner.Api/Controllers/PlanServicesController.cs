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
/// „ჩემი მომსახურებები“ (BUILD-PLAN B4, guide §6): the couple's vendors, saved from the catalog or
/// added by hand, each saved → shortlisted → chosen, with the offer and how to reach them. An
/// agreed price can go into the budget (amount + the next payment date). Shared by both partners.
/// </summary>
[ApiController]
[Route("api/planning/services")]
[Authorize(Roles = Roles.Couple)]
public class PlanServicesController : ControllerBase
{
    private const int MaxServices = 200;

    private readonly AppDbContext _db;
    private readonly CoupleScope _couple;

    public PlanServicesController(AppDbContext db, CoupleScope couple)
    {
        _db = db;
        _couple = couple;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<PlanServiceDto>>> List()
    {
        if (await _couple.IdAsync() is not int cid) return Forbid();
        return Ok(await LoadAsync(cid));
    }

    /// <summary>Add a vendor found elsewhere.</summary>
    [HttpPost]
    public async Task<ActionResult<PlanServiceDto>> Create([FromBody] PlanServiceCreateDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (await _couple.IdAsync() is not int cid) return Forbid();
        if (await _db.PlanServices.CountAsync(s => s.CoupleId == cid) >= MaxServices) return Conflict(new { code = "full" });

        var service = new PlanService
        {
            CoupleId = cid,
            Name = dto.Name.Trim(),
            CategorySlug = await KnownCategoryAsync(dto.CategorySlug),
            Status = StatusOr(dto.Status, PlanServiceRules.Saved),
            Phone = Clean(dto.Phone),
            Email = Clean(dto.Email),
            Instagram = Clean(dto.Instagram),
            Offer = dto.Offer,
            OfferNote = Clean(dto.OfferNote),
            Note = Clean(dto.Note),
            CreatedAt = DateTimeOffset.UtcNow,
        };
        _db.PlanServices.Add(service);
        await _db.SaveChangesAsync();
        return Ok((await LoadAsync(cid, service.Id)).Single());
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<PlanServiceDto>> Update(int id, [FromBody] PlanServiceUpdateDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (await _couple.IdAsync() is not int cid) return Forbid();
        var service = await _db.PlanServices.FirstOrDefaultAsync(s => s.Id == id && s.CoupleId == cid);
        if (service is null) return NotFound();

        service.Status = StatusOr(dto.Status, service.Status);
        service.Offer = dto.Offer;
        service.OfferNote = Clean(dto.OfferNote);
        service.Note = Clean(dto.Note);
        if (service.VendorId is null)
        {
            // Added by hand: the couple owns the name, category and contacts.
            if (!string.IsNullOrWhiteSpace(dto.Name)) service.Name = dto.Name.Trim();
            service.CategorySlug = await KnownCategoryAsync(dto.CategorySlug);
            service.Phone = Clean(dto.Phone);
            service.Email = Clean(dto.Email);
            service.Instagram = Clean(dto.Instagram);
        }
        await _db.SaveChangesAsync();
        return Ok((await LoadAsync(cid, service.Id)).Single());
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (await _couple.IdAsync() is not int cid) return Forbid();
        var deleted = await _db.PlanServices.Where(s => s.Id == id && s.CoupleId == cid).ExecuteDeleteAsync();
        return deleted == 0 ? NotFound() : NoContent();
    }

    /// <summary>
    /// The agreed price into the budget: the line that already carries this vendor, else an empty
    /// line of its category, else a new line. Sets the agreed cost and the next payment date; never
    /// overwrites a line that holds another vendor.
    /// </summary>
    [HttpPost("{id:int}/budget")]
    public async Task<ActionResult<PlanServiceToBudgetResultDto>> ToBudget(int id, [FromBody] PlanServiceToBudgetDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (await _couple.IdAsync() is not int cid) return Forbid();
        var service = await _db.PlanServices.FirstOrDefaultAsync(s => s.Id == id && s.CoupleId == cid);
        if (service is null) return NotFound();

        var lines = _db.BudgetItems.Where(b => b.CoupleId == cid);
        var item = service.VendorId is int vid
            ? await lines.FirstOrDefaultAsync(b => b.VendorId == vid)
            : await lines.FirstOrDefaultAsync(b => b.VendorId == null && b.MerchantName == service.Name);
        if (item is null && service.CategorySlug is not null)
        {
            item = await lines
                .Where(b => b.CategorySlug == service.CategorySlug && b.VendorId == null && b.MerchantName == null)
                .OrderBy(b => b.SortOrder)
                .FirstOrDefaultAsync();
        }

        var created = item is null;
        if (item is null)
        {
            var maxSort = await lines.Select(b => (int?)b.SortOrder).MaxAsync() ?? -1;
            item = new BudgetItem
            {
                CoupleId = cid,
                Name = service.Name,
                CategorySlug = service.CategorySlug,
                SortOrder = maxSort + 1,
                CreatedAt = DateTimeOffset.UtcNow,
            };
            _db.BudgetItems.Add(item);
        }

        // A line that gets the vendor now is called after them (as when one is linked on the budget
        // page), not after the category it was seeded with. One that already had them keeps its name.
        if (item.VendorId is null && item.MerchantName is null) item.Name = service.Name;
        if (service.VendorId is int vendorId)
        {
            item.VendorId = vendorId;
            item.MerchantName = null;
        }
        else
        {
            item.VendorId = null;
            item.MerchantName = service.Name;
        }
        item.ActualCost = dto.Amount;
        if (dto.DueDate is not null) item.ReminderDate = dto.DueDate;
        service.Offer ??= dto.Amount;

        await _db.SaveChangesAsync();
        return Ok(new PlanServiceToBudgetResultDto(item.Id, item.Name, created));
    }

    // ------------------------------------------------------------------ helpers

    private async Task<List<PlanServiceDto>> LoadAsync(int cid, int? onlyId = null)
    {
        var query = _db.PlanServices.AsNoTracking().Where(s => s.CoupleId == cid);
        if (onlyId is int one) query = query.Where(s => s.Id == one);

        var rows = await query
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => new
            {
                s.Id, s.Name, s.CategorySlug, s.Status, s.Phone, s.Email, s.Instagram, s.Offer, s.OfferNote, s.Note,
                s.CreatedAt, s.VendorId,
                Vendor = s.Vendor == null || !s.Vendor.IsApproved ? null : new
                {
                    s.Vendor.Id, s.Vendor.Slug, CategorySlug = s.Vendor.Category.Slug, GroupKey = s.Vendor.Category.GroupKey,
                    s.Vendor.CitySlug, s.Vendor.City, s.Vendor.PriceMin, s.Vendor.PriceUnit,
                    s.Vendor.Phone, s.Vendor.Instagram, s.Vendor.Whatsapp,
                    Photo = s.Vendor.Photos.OrderBy(p => p.SortOrder).Select(p => p.Url).FirstOrDefault(),
                },
            })
            .ToListAsync();

        // Which services a budget line already carries (by catalog vendor, or by name for hand-added).
        var lines = await _db.BudgetItems.AsNoTracking()
            .Where(b => b.CoupleId == cid && (b.VendorId != null || b.MerchantName != null))
            .Select(b => new { b.Id, b.VendorId, b.MerchantName })
            .ToListAsync();

        return rows.Select(r => new PlanServiceDto(
            r.Id, r.Name, r.CategorySlug, r.Status, r.Phone, r.Email, r.Instagram, r.Offer, r.OfferNote, r.Note,
            r.VendorId != null,
            r.Vendor is null ? null : new PlanServiceVendorDto(
                r.Vendor.Id, r.Vendor.Slug, r.Vendor.CategorySlug, r.Vendor.CitySlug, r.Vendor.City, r.Vendor.Photo,
                r.Vendor.PriceMin, r.Vendor.PriceUnit ?? CatalogRules.DefaultPriceUnit(r.Vendor.GroupKey),
                r.Vendor.Phone, r.Vendor.Instagram, r.Vendor.Whatsapp),
            r.VendorId is int v
                ? lines.FirstOrDefault(l => l.VendorId == v)?.Id
                : lines.FirstOrDefault(l => l.VendorId == null && l.MerchantName == r.Name)?.Id,
            r.CreatedAt)).ToList();
    }

    private async Task<string?> KnownCategoryAsync(string? slug)
    {
        var s = Clean(slug);
        return s is not null && await _db.Categories.AnyAsync(c => c.Slug == s) ? s : null;
    }

    private static string StatusOr(string? status, string fallback) =>
        status is not null && PlanServiceRules.Statuses.Contains(status.Trim()) ? status.Trim() : fallback;

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
