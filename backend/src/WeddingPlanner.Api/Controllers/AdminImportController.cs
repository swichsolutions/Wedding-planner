using WeddingPlanner.Api.Auth;
using WeddingPlanner.Api.Dtos;
using WeddingPlanner.Api.Import;
using WeddingPlanner.Domain.Entities;
using WeddingPlanner.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace WeddingPlanner.Api.Controllers;

/// <summary>
/// Loads the vendor collection spreadsheet (BUILD-PLAN A3) into vendor profiles. Photos aren't
/// in the file: the admin adds them per vendor afterwards (/admin/vendors/{id}).
/// </summary>
[ApiController]
[Route("api/admin/vendors/import")]
[Authorize(Roles = Roles.Admin)]
public class AdminImportController : ControllerBase
{
    private const long MaxBytes = 5 * 1024 * 1024;

    private readonly AppDbContext _db;

    public AdminImportController(AppDbContext db) => _db = db;

    /// <summary>
    /// `apply=false` (the default) only checks the file and says what each row would do;
    /// `apply=true` writes, in one transaction. A row whose Instagram matches an existing vendor
    /// updates it, unless that vendor manages their own profile (an account is linked), in which
    /// case the row is skipped. New profiles are hidden until approved, unless `publish=true`.
    /// </summary>
    [HttpPost]
    [RequestSizeLimit(MaxBytes + 64 * 1024)]
    public async Task<ActionResult<VendorImportReportDto>> Import(
        IFormFile? file, [FromQuery] bool apply = false, [FromQuery] bool publish = false)
    {
        if (file is null || file.Length == 0) return BadRequest(FileProblem("noFile"));
        if (file.Length > MaxBytes) return BadRequest(FileProblem("tooLarge"));

        // ClosedXML needs a seekable stream.
        using var buffer = new MemoryStream();
        await file.CopyToAsync(buffer);
        buffer.Position = 0;
        var sheet = VendorSheetReader.Read(buffer);
        if (sheet.FileErrors.Count > 0)
            return BadRequest(new VendorImportReportDto(false, 0, 0, 0, 0,
                Array.Empty<VendorImportRowDto>(), sheet.FileErrors, sheet.FileWarnings));

        var categories = await _db.Categories.AsNoTracking().ToDictionaryAsync(c => c.Slug);
        var plans = await PlanAsync(sheet.Vendors);

        if (apply && plans.Any(p => p.Action is "create" or "update"))
        {
            await using var tx = await _db.Database.BeginTransactionAsync();
            foreach (var plan in plans.Where(p => p.Action is "create" or "update"))
                await WriteAsync(plan, categories[plan.Row.CategorySlug!], publish);
            await tx.CommitAsync();
        }

        var rows = plans.Select(p => new VendorImportRowDto(
            p.Row.Row, p.Row.SheetId, p.Row.Name, p.Row.CategorySlug, p.Row.City, p.Action,
            p.VendorId, p.ProfilePath, p.Row.Packages.Count, p.Row.Photos,
            p.Row.Errors, p.Row.Warnings)).ToList();

        return Ok(new VendorImportReportDto(
            apply,
            plans.Count(p => p.Action == "create"),
            plans.Count(p => p.Action == "update"),
            plans.Count(p => p.Action == "skip"),
            plans.Count(p => p.Action == "error"),
            rows, sheet.FileErrors, sheet.FileWarnings));
    }

    private sealed class Plan
    {
        public required SheetVendor Row { get; init; }
        public required string Action { get; init; }
        public int? VendorId { get; set; }
        public string? ProfilePath { get; set; }
    }

    /// <summary>Decides create / update / skip / error for each row, without writing anything.</summary>
    private async Task<List<Plan>> PlanAsync(List<SheetVendor> rows)
    {
        // Existing vendors by Instagram handle (MVP scale: a few hundred rows at most).
        var existing = await _db.Vendors.AsNoTracking()
            .Where(v => v.Instagram != null)
            .OrderBy(v => v.Id)
            .Select(v => new { v.Id, v.Instagram, CategorySlug = v.Category.Slug, v.CitySlug, v.Slug })
            .ToListAsync();
        var owned = (await _db.Users.Where(u => u.VendorId != null).Select(u => u.VendorId!.Value).ToListAsync())
            .ToHashSet();
        var byHandle = existing
            .Select(v => (Handle: VendorSheetReader.InstagramHandle(v.Instagram), Vendor: v))
            .Where(x => x.Handle is not null)
            .GroupBy(x => x.Handle!)
            .ToDictionary(g => g.Key, g => g.Select(x => x.Vendor).ToList());

        var plans = new List<Plan>();
        foreach (var row in rows)
        {
            if (row.Errors.Count > 0)
            {
                plans.Add(new Plan { Row = row, Action = "error" });
                continue;
            }
            if (!byHandle.TryGetValue(row.InstagramKey!, out var matches))
            {
                plans.Add(new Plan { Row = row, Action = "create" });
                continue;
            }
            // A vendor who manages their own profile keeps it as they left it.
            var own = matches.FirstOrDefault(m => owned.Contains(m.Id));
            var target = own ?? matches[0];
            if (own is not null) row.Warnings.Add(new ImportIssue("owned", Value: own.Instagram));
            plans.Add(new Plan
            {
                Row = row,
                Action = own is null ? "update" : "skip",
                VendorId = target.Id,
                ProfilePath = $"/{target.CategorySlug}/{target.CitySlug}/{target.Slug}",
            });
        }
        return plans;
    }

    /// <summary>
    /// Writes one row. The sheet is the source for the fields it has (a blank cell clears the
    /// field); what it doesn't have (photos, features, map link, price range) is left as it is.
    /// </summary>
    private async Task WriteAsync(Plan plan, Category category, bool publish)
    {
        var row = plan.Row;
        Vendor v;
        if (plan.Action == "update")
        {
            v = await _db.Vendors.Include(x => x.Packages).FirstAsync(x => x.Id == plan.VendorId);
        }
        else
        {
            // Placeholder slug first: the real one ends in the id, which only the insert gives
            // (the same two-step as vendor registration).
            v = new Vendor { Slug = $"pending-{Guid.NewGuid():N}", CreatedAt = DateTimeOffset.UtcNow };
            _db.Vendors.Add(v);
        }

        var group = category.GroupKey;
        v.Name = row.Name!;
        v.CategoryId = category.Id;
        if (v.City != row.City)
        {
            v.City = row.City!;
            v.CitySlug = Slugs.From(row.City);
        }
        v.Region = row.Region;
        v.ServedRegions = row.ServedRegions;
        v.AlsoOffers = row.AlsoOffers;
        v.Instagram = row.Instagram;
        v.Facebook = row.Facebook;
        v.Phone = row.Phone;
        v.Whatsapp = row.Whatsapp;
        v.MessageEmail = row.Email;
        v.PriceMin = row.PriceMin;
        v.PriceUnit = row.PriceUnit;
        v.Bio = row.Bio;
        v.Styles = row.Styles;
        // Features aren't in the sheet; keep the ones that still fit the (possibly new) group.
        v.Features = CatalogRules.Clean(v.Features, CatalogRules.Features.GetValueOrDefault(group) ?? Array.Empty<string>());
        v.VenueType = row.VenueType;
        v.CapacityMin = row.CapacityMin;
        v.CapacityMax = row.CapacityMax;
        v.Setting = row.Setting;
        v.DepositTerms = row.DepositTerms;
        v.CancellationTerms = row.CancellationTerms;
        v.TravelPolicy = row.TravelPolicy;
        v.BookingLeadTime = row.BookingLeadTime;
        v.ConsentBy = row.ConsentBy;
        v.ConsentOn = row.ConsentOn;
        v.ConsentMethod = row.ConsentMethod;
        if (publish) v.IsApproved = true;

        _db.VendorPackages.RemoveRange(v.Packages);
        v.Packages = row.Packages.Select((p, i) => new VendorPackage
        {
            Name = p.Name,
            Price = p.Price,
            PriceUnit = p.PriceUnit,
            Included = p.Included,
            Duration = p.Duration,
            SortOrder = i,
        }).ToList();

        await _db.SaveChangesAsync();

        if (plan.Action == "create")
        {
            var nameSlug = Slugs.From(v.Name);
            v.Slug = nameSlug.Length > 0 ? $"{nameSlug}-{v.Id}" : $"vendor-{v.Id}";
        }
        if (v.CitySlug.Length == 0) v.CitySlug = $"city-{v.Id}";
        await _db.SaveChangesAsync();

        plan.VendorId = v.Id;
        plan.ProfilePath = $"/{category.Slug}/{v.CitySlug}/{v.Slug}";
    }

    private static VendorImportReportDto FileProblem(string code) => new(
        false, 0, 0, 0, 0, Array.Empty<VendorImportRowDto>(), new[] { new ImportIssue(code) }, Array.Empty<ImportIssue>());
}
