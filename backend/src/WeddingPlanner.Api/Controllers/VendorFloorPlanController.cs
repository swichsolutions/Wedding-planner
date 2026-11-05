using WeddingPlanner.Api.Auth;
using WeddingPlanner.Api.Dtos;
using WeddingPlanner.Infrastructure.Data;
using WeddingPlanner.Infrastructure.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace WeddingPlanner.Api.Controllers;

/// <summary>
/// The venue's floor plan (BUILD-PLAN B5): one image per vendor, uploaded by the vendor or by an
/// admin finishing an imported profile. Venues send PDFs, photos and screenshots of their tables;
/// the browser turns a PDF's first page into an image before it gets here, so only images arrive.
/// Couples copy it under their seating chart (<see cref="SeatingController.UseVenuePlan"/>).
/// </summary>
[ApiController]
[Route("api/vendor/me/floor-plan")]
[Route("api/admin/vendors/{vendorId:int}/floor-plan")]
[Authorize(Roles = Roles.Vendor + "," + Roles.Admin)]
public class VendorFloorPlanController : ControllerBase
{
    private const long MaxBytes = 8 * 1024 * 1024; // 8 MB
    private static readonly string[] AllowedTypes = { "image/jpeg", "image/png", "image/webp" };

    private readonly AppDbContext _db;
    private readonly IPhotoStorage _storage;
    private readonly ILogger<VendorFloorPlanController> _logger;

    public VendorFloorPlanController(AppDbContext db, IPhotoStorage storage, ILogger<VendorFloorPlanController> logger)
    {
        _db = db;
        _storage = storage;
        _logger = logger;
    }

    /// <summary>The vendor's own record, or any vendor's for an admin on the admin route.</summary>
    private int? VendorId => VendorScope.Resolve(User, RouteData);

    [HttpPost]
    [RequestSizeLimit(MaxBytes + 1024)]
    public async Task<ActionResult<VendorFloorPlanDto>> Upload(IFormFile? file)
    {
        if (VendorId is not int vid) return Forbid();
        if (file is null || file.Length == 0) return BadRequest("No file provided.");
        if (file.Length > MaxBytes) return BadRequest("File too large (max 8 MB).");
        if (!AllowedTypes.Contains(file.ContentType))
            return BadRequest("Unsupported file type. Use JPG, PNG, or WebP.");

        // Content-Type and filename are client-controlled; only the magic bytes decide.
        string? ext;
        await using (var sniff = file.OpenReadStream())
        {
            ext = await ImageSniffer.DetectExtensionAsync(sniff);
        }
        if (ext is null) return BadRequest("Unsupported file type. Use JPG, PNG, or WebP.");

        var vendor = await _db.Vendors.FirstOrDefaultAsync(v => v.Id == vid);
        if (vendor is null) return NotFound();

        StoredPhoto stored;
        await using (var stream = file.OpenReadStream())
        {
            stored = await _storage.UploadAsync(stream, $"floorplan{ext}");
        }

        var old = vendor.FloorPlanStorageId;
        vendor.FloorPlanUrl = stored.Url;
        vendor.FloorPlanStorageId = stored.StorageId;
        await _db.SaveChangesAsync();
        // The old image goes only after the new one is saved. Couples hold their own copies.
        await TryDeleteBlobAsync(old);

        return Ok(new VendorFloorPlanDto(vendor.FloorPlanUrl));
    }

    [HttpDelete]
    public async Task<ActionResult<VendorFloorPlanDto>> Remove()
    {
        if (VendorId is not int vid) return Forbid();
        var vendor = await _db.Vendors.FirstOrDefaultAsync(v => v.Id == vid);
        if (vendor is null) return NotFound();

        var old = vendor.FloorPlanStorageId;
        vendor.FloorPlanUrl = null;
        vendor.FloorPlanStorageId = null;
        await _db.SaveChangesAsync();
        await TryDeleteBlobAsync(old);

        return Ok(new VendorFloorPlanDto(null));
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
