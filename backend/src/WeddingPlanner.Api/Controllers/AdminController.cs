using WeddingPlanner.Api.Auth;
using WeddingPlanner.Api.Dtos;
using WeddingPlanner.Api.Search;
using WeddingPlanner.Domain.Entities;
using WeddingPlanner.Infrastructure.Data;
using WeddingPlanner.Infrastructure.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace WeddingPlanner.Api.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Roles = Roles.Admin)]
public class AdminController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IPhotoStorage _storage;
    private readonly ILogger<AdminController> _logger;
    private readonly IndexNowQueue _indexNow;

    public AdminController(AppDbContext db, IPhotoStorage storage, ILogger<AdminController> logger, IndexNowQueue indexNow)
    {
        _db = db;
        _storage = storage;
        _logger = logger;
        _indexNow = indexNow;
    }

    /// <summary>List vendors for moderation. `pending=true` returns only unapproved.</summary>
    [HttpGet("vendors")]
    public async Task<ActionResult<IEnumerable<AdminVendorDto>>> ListVendors([FromQuery] bool? pending)
    {
        var query = _db.Vendors.AsNoTracking().Include(v => v.Category).AsQueryable();
        if (pending == true)
            query = query.Where(v => !v.IsApproved);

        var vendors = await query
            .OrderByDescending(v => v.CreatedAt)
            .Select(v => new AdminVendorDto(
                v.Id, v.Name, v.Category.Slug, v.City, v.IsApproved, v.IsFeatured, v.CreatedAt,
                v.Slug, v.CitySlug,
                _db.Users.Any(u => u.VendorId == v.Id),
                v.Photos.Count,
                _db.Users.Where(u => u.VendorId == v.Id).Select(u => u.Email).FirstOrDefault(),
                v.ClaimCodeExpiresAt > DateTimeOffset.UtcNow ? v.ClaimCodeExpiresAt : null))
            .ToListAsync();

        return Ok(vendors);
    }

    /// <summary>
    /// A new one-time code for a profile nobody owns yet (ClaimCodes): shown to the admin once, to
    /// send to the vendor's own Instagram, WhatsApp or phone. Replaces any earlier code.
    /// </summary>
    [HttpPost("vendors/{id:int}/claim-code")]
    public async Task<ActionResult<ClaimCodeCreatedDto>> CreateClaimCode(int id)
    {
        var v = await _db.Vendors.FindAsync(id);
        if (v is null) return NotFound();
        if (await _db.Users.AnyAsync(u => u.VendorId == id)) return Conflict(new { code = "has_owner" });

        // a fresh code until its hash is free (a clash is astronomically rare, but the index is unique)
        string code, hash;
        do
        {
            code = ClaimCodes.Generate();
            hash = ClaimCodes.Hash(code)!;
        } while (await _db.Vendors.AnyAsync(x => x.ClaimCodeHash == hash));

        v.ClaimCodeHash = hash;
        v.ClaimCodeExpiresAt = DateTimeOffset.UtcNow.Add(ClaimCodes.Lifetime);
        await _db.SaveChangesAsync();
        return Ok(new ClaimCodeCreatedDto(code, v.ClaimCodeExpiresAt.Value));
    }

    /// <summary>Cancels the open code (sent to the wrong person, say): the link stops working at once.</summary>
    [HttpDelete("vendors/{id:int}/claim-code")]
    public async Task<IActionResult> DeleteClaimCode(int id)
    {
        var v = await _db.Vendors.FindAsync(id);
        if (v is null) return NotFound();
        v.ClaimCodeHash = null;
        v.ClaimCodeExpiresAt = null;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// Takes the profile away from its owner account (the wrong person got it): the account stays,
    /// without a profile, and the admin can make a new code for the right vendor. The account's
    /// current sign-in still names the profile until it expires or the person signs in again.
    /// </summary>
    [HttpPost("vendors/{id:int}/unlink-owner")]
    public async Task<IActionResult> UnlinkOwner(int id)
    {
        var unlinked = await _db.Users.Where(u => u.VendorId == id)
            .ExecuteUpdateAsync(s => s.SetProperty(u => u.VendorId, (int?)null));
        return unlinked == 0 ? NotFound() : NoContent();
    }

    /// <summary>
    /// Add one vendor by hand: unapproved, no owner, the editor opens on it next. Same slug
    /// rules as self-registration.
    /// </summary>
    [HttpPost("vendors")]
    public async Task<ActionResult<AdminVendorDto>> Create([FromBody] AdminCreateVendorDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        var category = await _db.Categories.FirstOrDefaultAsync(c => c.Slug == dto.CategorySlug);
        if (category is null) return BadRequest("Unknown category.");

        var v = new Vendor
        {
            Name = dto.Name.Trim(),
            Slug = $"pending-{Guid.NewGuid():N}",
            CategoryId = category.Id,
            City = dto.City?.Trim() ?? string.Empty,
            CitySlug = Slugs.From(dto.City),
            Bio = string.Empty,
            Phone = string.IsNullOrWhiteSpace(dto.Phone) ? null : dto.Phone.Trim(),
            Instagram = string.IsNullOrWhiteSpace(dto.Instagram) ? null : dto.Instagram.Trim(),
            IsApproved = false,
            IsFeatured = false,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        _db.Vendors.Add(v);
        await _db.SaveChangesAsync();

        var nameSlug = Slugs.From(v.Name);
        v.Slug = string.IsNullOrEmpty(nameSlug) ? $"vendor-{v.Id}" : $"{nameSlug}-{v.Id}";
        if (string.IsNullOrEmpty(v.CitySlug))
            v.CitySlug = $"city-{v.Id}";
        await _db.SaveChangesAsync();

        return Ok(new AdminVendorDto(v.Id, v.Name, category.Slug, v.City, v.IsApproved, v.IsFeatured,
            v.CreatedAt, v.Slug, v.CitySlug, false, 0));
    }

    [HttpPost("vendors/{id:int}/approve")]
    public async Task<IActionResult> Approve(int id)
    {
        var v = await _db.Vendors.FindAsync(id);
        if (v is null) return NotFound();
        // Self-registration doesn't ask for a city; public pages and URLs can't do without one.
        if (string.IsNullOrWhiteSpace(v.City)) return Conflict(new { code = "no_city" });
        v.IsApproved = true;
        await _db.SaveChangesAsync();
        _indexNow.Vendor(v.Id); // a new page, and new entries on its catalog pages
        return NoContent();
    }

    /// <summary>
    /// Permanently removes a vendor, with its photos, packages, reviews and messages. Couples who
    /// saved it keep their plan rows, just no longer linked. An owner's account stays, without a
    /// profile. The stored images go after the commit: an orphaned image is recoverable garbage,
    /// a row pointing at a deleted image isn't.
    /// </summary>
    [HttpDelete("vendors/{id:int}")]
    public async Task<IActionResult> DeleteVendor(int id)
    {
        var v = await _db.Vendors.Include(x => x.Photos).Include(x => x.Category).FirstOrDefaultAsync(x => x.Id == id);
        if (v is null) return NotFound();

        var images = v.Photos.Select(p => p.StorageId).Append(v.FloorPlanStorageId).Where(s => s is not null).ToList();
        // worked out now: after the delete there is no row left to find the addresses from
        var listedAt = v.IsApproved && v.City != "" && v.CitySlug != ""
            ? IndexNowPaths.ForVendor(v.Category.Slug, v.Category.GroupKey, v.CitySlug, v.Slug).ToList()
            : null;

        await _db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            await using var tx = await _db.Database.BeginTransactionAsync();
            await _db.Users.Where(u => u.VendorId == id).ExecuteUpdateAsync(s => s.SetProperty(u => u.VendorId, (int?)null));
            await _db.Couples.Where(x => x.FloorPlanVendorId == id).ExecuteUpdateAsync(s => s.SetProperty(x => x.FloorPlanVendorId, (int?)null));
            _db.Vendors.Remove(v);
            await _db.SaveChangesAsync();
            await tx.CommitAsync();
        });
        if (listedAt is not null) _indexNow.Paths(listedAt); // the page is gone: let the engines drop it

        foreach (var image in images)
        {
            try
            {
                await _storage.DeleteAsync(image);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Orphaned vendor image {StorageId} could not be deleted.", image);
            }
        }

        return NoContent();
    }

    /// <summary>
    /// Remove one review (spam, abuse, a vendor's justified complaint). The vendor's rating and
    /// review count are worked out from the remaining rows on every read, so nothing else to fix.
    /// </summary>
    [HttpDelete("reviews/{id:int}")]
    public async Task<IActionResult> DeleteReview(int id)
    {
        var vendorId = await _db.Reviews.Where(r => r.Id == id).Select(r => (int?)r.VendorId).FirstOrDefaultAsync();
        var deleted = await _db.Reviews.Where(r => r.Id == id).ExecuteDeleteAsync();
        if (deleted == 0) return NotFound();
        if (vendorId is int vid) _indexNow.Vendor(vid);
        return NoContent();
    }

    /// <summary>Toggle the (dormant-monetization) featured flag.</summary>
    [HttpPost("vendors/{id:int}/feature")]
    public async Task<IActionResult> ToggleFeature(int id)
    {
        var v = await _db.Vendors.FindAsync(id);
        if (v is null) return NotFound();
        v.IsFeatured = !v.IsFeatured;
        await _db.SaveChangesAsync();
        return Ok(new { v.Id, v.IsFeatured });
    }
}
