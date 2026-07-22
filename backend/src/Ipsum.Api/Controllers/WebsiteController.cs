using System.Security.Claims;
using System.Text;
using System.Text.RegularExpressions;
using Ipsum.Api.Auth;
using Ipsum.Api.Dtos;
using Ipsum.Domain.Entities;
using Ipsum.Infrastructure.Data;
using Ipsum.Infrastructure.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ipsum.Api.Controllers;

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
    };

    private const long MaxPhotoBytes = 8 * 1024 * 1024; // 8 MB
    private static readonly string[] AllowedPhotoTypes = { "image/jpeg", "image/png", "image/webp" };

    private readonly AppDbContext _db;
    private readonly IPhotoStorage _storage;

    public WebsiteController(AppDbContext db, IPhotoStorage storage)
    {
        _db = db;
        _storage = storage;
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

        StoredPhoto stored;
        await using (var stream = file.OpenReadStream())
        {
            stored = await _storage.UploadAsync(stream, file.FileName);
        }

        // Replace: remove the previous photo from storage before pointing at the new one.
        if (!string.IsNullOrEmpty(site.PhotoStorageId))
            await _storage.DeleteAsync(site.PhotoStorageId);

        site.PhotoUrl = stored.Url;
        site.PhotoStorageId = stored.StorageId;
        site.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(Map(site));
    }

    [HttpDelete("photo")]
    public async Task<ActionResult<WeddingSiteDto>> RemovePhoto()
    {
        if (UserId is not string uid) return Forbid();
        var site = await _db.WeddingSites.FirstOrDefaultAsync(s => s.UserId == uid);
        if (site is null) return NotFound();

        if (!string.IsNullOrEmpty(site.PhotoStorageId))
            await _storage.DeleteAsync(site.PhotoStorageId);
        site.PhotoUrl = null;
        site.PhotoStorageId = null;
        site.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(Map(site));
    }

    [HttpPost("publish")]
    public async Task<ActionResult<WeddingSiteDto>> Publish()
    {
        if (UserId is not string uid) return Forbid();
        var site = await _db.WeddingSites.FirstOrDefaultAsync(s => s.UserId == uid);
        if (site is null) return NotFound();

        // The slug is minted once, on first publish, and stays stable afterwards —
        // shared links must not break when the couple re-publishes.
        site.Slug ??= await UniqueSlugAsync(site);
        site.IsPublished = true;
        site.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();

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
            s.PhotoUrl, s.IsPublished, s.Slug);

    private static string? Clean(string? s)
    {
        var trimmed = s?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }

    // ---- slug generation ----

    private async Task<string> UniqueSlugAsync(WeddingSite site)
    {
        var parts = new[] { site.FirstName, site.PartnerFirstName }
            .Select(Transliterate)
            .Where(p => p.Length > 0)
            .ToList();
        var baseSlug = parts.Count > 0 ? string.Join("-", parts) : "chveni-qortsili";
        if (site.WeddingDate is DateOnly d) baseSlug += $"-{d.Year}";

        var slug = baseSlug;
        for (var n = 2; await _db.WeddingSites.AnyAsync(s => s.Slug == slug); n++)
            slug = $"{baseSlug}-{n}";
        return slug;
    }

    /// <summary>Georgian Mkhedruli → Latin; Latin passes through; everything else drops.</summary>
    private static string Transliterate(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) return string.Empty;

        var sb = new StringBuilder(input.Length * 2);
        foreach (var ch in input.ToLowerInvariant())
        {
            if (GeorgianToLatin.TryGetValue(ch, out var latin)) sb.Append(latin);
            else if (ch is >= 'a' and <= 'z' or >= '0' and <= '9') sb.Append(ch);
            else sb.Append('-');
        }
        return Regex.Replace(sb.ToString(), "-{2,}", "-").Trim('-');
    }

    private static readonly Dictionary<char, string> GeorgianToLatin = new()
    {
        ['ა'] = "a", ['ბ'] = "b", ['გ'] = "g", ['დ'] = "d", ['ე'] = "e", ['ვ'] = "v",
        ['ზ'] = "z", ['თ'] = "t", ['ი'] = "i", ['კ'] = "k", ['ლ'] = "l", ['მ'] = "m",
        ['ნ'] = "n", ['ო'] = "o", ['პ'] = "p", ['ჟ'] = "zh", ['რ'] = "r", ['ს'] = "s",
        ['ტ'] = "t", ['უ'] = "u", ['ფ'] = "p", ['ქ'] = "q", ['ღ'] = "gh", ['ყ'] = "q",
        ['შ'] = "sh", ['ჩ'] = "ch", ['ც'] = "ts", ['ძ'] = "dz", ['წ'] = "ts", ['ჭ'] = "ch",
        ['ხ'] = "kh", ['ჯ'] = "j", ['ჰ'] = "h",
    };
}
