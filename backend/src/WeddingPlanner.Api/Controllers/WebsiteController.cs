using System.Security.Claims;
using System.Text;
using System.Text.RegularExpressions;
using WeddingPlanner.Api.Auth;
using WeddingPlanner.Api.Dtos;
using WeddingPlanner.Domain.Entities;
using WeddingPlanner.Infrastructure.Data;
using WeddingPlanner.Infrastructure.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace WeddingPlanner.Api.Controllers;

/// <summary>
/// The couple's personal wedding website: pick a design, fill the details, publish
/// to a public /w/{slug} URL. One site per couple account.
/// </summary>
[ApiController]
[Route("api/planning/website")]
[Authorize(Roles = Roles.Couple)]
public class WebsiteController : ControllerBase
{
    /// <summary>Design catalog — must match the frontend's template keys.</summary>
    public static readonly string[] TemplateKeys =
    {
        "glow", "calligraphy", "garnet", "forest", "seaside",
        "minimal", "blush", "vineyard", "midnight", "sunrise",
        "minankari", "pardagi", "pearl", "tbilisi",
    };

    private const long MaxPhotoBytes = 8 * 1024 * 1024; // 8 MB
    private static readonly string[] AllowedPhotoTypes = { "image/jpeg", "image/png", "image/webp" };

    private readonly AppDbContext _db;
    private readonly IPhotoStorage _storage;
    private readonly ILogger<WebsiteController> _logger;

    public WebsiteController(AppDbContext db, IPhotoStorage storage, ILogger<WebsiteController> logger)
    {
        _db = db;
        _storage = storage;
        _logger = logger;
    }

    /// <summary>
    /// Best-effort blob cleanup AFTER the DB commit — an orphaned blob is recoverable
    /// garbage, but a committed row pointing at a deleted blob is a broken image.
    /// </summary>
    private async Task TryDeleteBlobAsync(string? storageId)
    {
        if (string.IsNullOrEmpty(storageId)) return;
        try
        {
            await _storage.DeleteAsync(storageId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Orphaned photo blob {StorageId} could not be deleted.", storageId);
        }
    }

    private string? UserId => User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    [HttpGet]
    public async Task<ActionResult<WeddingSiteDto>> Get()
    {
        if (UserId is not string uid) return Forbid();
        var site = await _db.WeddingSites.AsNoTracking().FirstOrDefaultAsync(s => s.UserId == uid);
        if (site is null) return NoContent(); // not created yet — the builder starts at design pick
        return Ok(Map(site));
    }

    [HttpPut]
    public async Task<ActionResult<WeddingSiteDto>> Upsert([FromBody] WeddingSiteUpdateDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (UserId is not string uid) return Forbid();
        if (!TemplateKeys.Contains(dto.TemplateKey)) return BadRequest("Unknown template.");

        var site = await _db.WeddingSites.FirstOrDefaultAsync(s => s.UserId == uid);
        if (site is null)
        {
            site = new WeddingSite { UserId = uid, CreatedAt = DateTimeOffset.UtcNow };
            _db.WeddingSites.Add(site);
        }

        site.TemplateKey = dto.TemplateKey;
        site.FirstName = Clean(dto.FirstName);
        site.LastName = Clean(dto.LastName);
        site.PartnerFirstName = Clean(dto.PartnerFirstName);
        site.PartnerLastName = Clean(dto.PartnerLastName);
        site.WeddingDate = dto.WeddingDate;
        site.Place = Clean(dto.Place);
        site.Message = Clean(dto.Message);
        site.InkColor = Clean(dto.InkColor)?.ToLowerInvariant();
        site.AccentColor = Clean(dto.AccentColor)?.ToLowerInvariant();
        site.PhotoFocusX = dto.PhotoFocusX ?? site.PhotoFocusX;
        site.PhotoFocusY = dto.PhotoFocusY ?? site.PhotoFocusY;
        site.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(Map(site));
    }

    [HttpPost("photo")]
    [RequestSizeLimit(MaxPhotoBytes + 1024)]
    public async Task<ActionResult<WeddingSiteDto>> UploadPhoto(IFormFile? file)
    {
        if (UserId is not string uid) return Forbid();
        var site = await _db.WeddingSites.FirstOrDefaultAsync(s => s.UserId == uid);
        if (site is null) return NotFound();

        if (file is null || file.Length == 0) return BadRequest("No file provided.");
        if (file.Length > MaxPhotoBytes) return BadRequest("File too large (max 8 MB).");
        if (!AllowedPhotoTypes.Contains(file.ContentType))
            return BadRequest("Unsupported file type. Use JPG, PNG, or WebP.");

        // Content-Type and filename are client-controlled; only the magic bytes decide
        // whether this is stored (and which extension it's served with).
        string? ext;
        await using (var sniff = file.OpenReadStream())
        {
            ext = await ImageSniffer.DetectExtensionAsync(sniff);
        }
        if (ext is null)
            return BadRequest("Unsupported file type. Use JPG, PNG, or WebP.");

        StoredPhoto stored;
        await using (var stream = file.OpenReadStream())
        {
            stored = await _storage.UploadAsync(stream, $"photo{ext}");
        }

        var oldStorageId = site.PhotoStorageId;
        site.PhotoUrl = stored.Url;
        site.PhotoStorageId = stored.StorageId;
        // A new photo starts centered — the old focal point belonged to the old image.
        site.PhotoFocusX = 50;
        site.PhotoFocusY = 50;
        site.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();

        // Replace: the OLD blob is removed only after the new URL is committed.
        await TryDeleteBlobAsync(oldStorageId);

        return Ok(Map(site));
    }

    [HttpDelete("photo")]
    public async Task<ActionResult<WeddingSiteDto>> RemovePhoto()
    {
        if (UserId is not string uid) return Forbid();
        var site = await _db.WeddingSites.FirstOrDefaultAsync(s => s.UserId == uid);
        if (site is null) return NotFound();

        var oldStorageId = site.PhotoStorageId;
        site.PhotoUrl = null;
        site.PhotoStorageId = null;
        site.PhotoFocusX = 50;
        site.PhotoFocusY = 50;
        site.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();

        await TryDeleteBlobAsync(oldStorageId);

        return Ok(Map(site));
    }

    [HttpPost("publish")]
    public async Task<ActionResult<WeddingSiteDto>> Publish()
    {
        if (UserId is not string uid) return Forbid();
        var site = await _db.WeddingSites.FirstOrDefaultAsync(s => s.UserId == uid);
        if (site is null) return NotFound();

        // The slug is minted once, on first publish, and stays stable afterwards —
        // shared links must not break when the couple re-publishes. Minting is
        // check-then-insert against a unique index, so a concurrent publish with the
        // same names can win the slug between our check and save: re-mint and retry.
        for (var attempt = 0; ; attempt++)
        {
            site.Slug ??= await UniqueSlugAsync(site);
            site.IsPublished = true;
            site.UpdatedAt = DateTimeOffset.UtcNow;
            try
            {
                await _db.SaveChangesAsync();
                break;
            }
            catch (DbUpdateException ex) when (DbErrors.IsUniqueViolation(ex) && attempt < 3)
            {
                site.Slug = null; // the next UniqueSlugAsync sees the winner's row and suffixes past it
            }
        }

        return Ok(Map(site));
    }

    [HttpPost("unpublish")]
    public async Task<ActionResult<WeddingSiteDto>> Unpublish()
    {
        if (UserId is not string uid) return Forbid();
        var site = await _db.WeddingSites.FirstOrDefaultAsync(s => s.UserId == uid);
        if (site is null) return NotFound();

        site.IsPublished = false;
        site.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(Map(site));
    }

    private static WeddingSiteDto Map(WeddingSite s) =>
        new(
            s.TemplateKey, s.FirstName, s.LastName, s.PartnerFirstName, s.PartnerLastName,
            s.WeddingDate, s.Place, s.Message, s.InkColor, s.AccentColor,
            s.PhotoUrl, s.PhotoFocusX, s.PhotoFocusY, s.IsPublished, s.Slug);

    private static string? Clean(string? s)
    {
        var trimmed = s?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }

    // ---- slug generation ----

    private async Task<string> UniqueSlugAsync(WeddingSite site)
    {
        var parts = new[] { site.FirstName, site.PartnerFirstName }
            .Select(Slugs.From)
            .Where(p => p.Length > 0)
            .ToList();
        var baseSlug = parts.Count > 0 ? string.Join("-", parts) : "chveni-qortsili";
        if (site.WeddingDate is DateOnly d) baseSlug += $"-{d.Year}";

        // Slugs.From caps each PART at 80 chars, but two joined parts + "-{year}"
        // can still exceed WeddingSite.Slug's varchar(160) — and a 22001 "value too
        // long" is not the unique violation the publish retry recovers from. Cap the
        // joined base with room to spare for the "-{n}" collision suffix.
        if (baseSlug.Length > 140) baseSlug = baseSlug[..140].Trim('-');

        var slug = baseSlug;
        for (var n = 2; await _db.WeddingSites.AnyAsync(s => s.Slug == slug); n++)
            slug = $"{baseSlug}-{n}";
        return slug;
    }

}
