using Ipsum.Api.Auth;
using Ipsum.Api.Dtos;
using Ipsum.Domain.Entities;
using Ipsum.Infrastructure.Data;
using Ipsum.Infrastructure.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ipsum.Api.Controllers;

[ApiController]
[Route("api/vendor/me/photos")]
[Authorize(Roles = Roles.Vendor)]
public class VendorPhotosController : ControllerBase
{
    private const int MaxPhotos = 20;
    private const long MaxBytes = 8 * 1024 * 1024; // 8 MB
    private static readonly string[] AllowedTypes = { "image/jpeg", "image/png", "image/webp" };

    private readonly AppDbContext _db;
    private readonly IPhotoStorage _storage;

    public VendorPhotosController(AppDbContext db, IPhotoStorage storage)
    {
        _db = db;
        _storage = storage;
    }

    private int? VendorId =>
        int.TryParse(User.FindFirst("vendorId")?.Value, out var id) ? id : null;

    [HttpGet]
    public async Task<ActionResult<IEnumerable<VendorPhotoAdminDto>>> List()
    {
        if (VendorId is not int vid) return Forbid();
        var photos = await _db.VendorPhotos
            .AsNoTracking()
            .Where(p => p.VendorId == vid)
            .OrderBy(p => p.SortOrder)
            .Select(p => new VendorPhotoAdminDto(p.Id, p.Url, p.AltText, p.IsRealWedding, p.SortOrder))
            .ToListAsync();
        return Ok(photos);
    }

    [HttpPost]
    [RequestSizeLimit(MaxBytes + 1024)]
    public async Task<ActionResult<VendorPhotoAdminDto>> Upload(IFormFile? file)
    {
        if (VendorId is not int vid) return Forbid();

        if (file is null || file.Length == 0)
            return BadRequest("No file provided.");
        if (file.Length > MaxBytes)
            return BadRequest("File too large (max 8 MB).");
        if (!AllowedTypes.Contains(file.ContentType))
            return BadRequest("Unsupported file type. Use JPG, PNG, or WebP.");

        var count = await _db.VendorPhotos.CountAsync(p => p.VendorId == vid);
        if (count >= MaxPhotos)
            return BadRequest($"Photo limit reached (max {MaxPhotos}).");

        StoredPhoto stored;
        await using (var stream = file.OpenReadStream())
        {
            stored = await _storage.UploadAsync(stream, file.FileName);
        }

        var maxSort = await _db.VendorPhotos
            .Where(p => p.VendorId == vid)
            .Select(p => (int?)p.SortOrder)
            .MaxAsync() ?? -1;

        var photo = new VendorPhoto
        {
            VendorId = vid,
            Url = stored.Url,
            StorageId = stored.StorageId,
            SortOrder = maxSort + 1,
            IsRealWedding = false,
        };
        _db.VendorPhotos.Add(photo);
        await _db.SaveChangesAsync();

        return Ok(new VendorPhotoAdminDto(photo.Id, photo.Url, photo.AltText, photo.IsRealWedding, photo.SortOrder));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] PhotoUpdateDto dto)
    {
        if (VendorId is not int vid) return Forbid();
        var photo = await _db.VendorPhotos.FirstOrDefaultAsync(p => p.Id == id && p.VendorId == vid);
        if (photo is null) return NotFound();

        photo.AltText = dto.Alt?.Trim();
        photo.IsRealWedding = dto.IsRealWedding;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPut("order")]
    public async Task<IActionResult> Reorder([FromBody] PhotoReorderDto dto)
    {
        if (VendorId is not int vid) return Forbid();
        var photos = await _db.VendorPhotos.Where(p => p.VendorId == vid).ToListAsync();
        for (var i = 0; i < dto.Ids.Length; i++)
        {
            var photo = photos.FirstOrDefault(p => p.Id == dto.Ids[i]);
            if (photo is not null) photo.SortOrder = i;
        }
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (VendorId is not int vid) return Forbid();
        var photo = await _db.VendorPhotos.FirstOrDefaultAsync(p => p.Id == id && p.VendorId == vid);
        if (photo is null) return NotFound();

        await _storage.DeleteAsync(photo.StorageId);
        _db.VendorPhotos.Remove(photo);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
