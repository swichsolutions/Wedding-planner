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
/// Content editor for admins: articles, inspiration ideas, real weddings and the legal pages.
/// Errors carry a short code the admin UI localizes.
/// </summary>
[ApiController]
[Route("api/admin/content")]
[Authorize(Roles = Roles.Admin)]
public class AdminContentController : ControllerBase
{
    private const int MaxPhotos = 40;
    private const long MaxBytes = 8 * 1024 * 1024; // 8 MB
    private static readonly string[] AllowedTypes = { "image/jpeg", "image/png", "image/webp" };
    private static readonly Regex SlugPattern = new("^[a-z0-9]+(?:-[a-z0-9]+)*$", RegexOptions.Compiled);

    private readonly AppDbContext _db;
    private readonly IPhotoStorage _storage;
    private readonly ILogger<AdminContentController> _logger;

    public AdminContentController(AppDbContext db, IPhotoStorage storage, ILogger<AdminContentController> logger)
    {
        _db = db;
        _storage = storage;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<AdminContentRowDto>>> List()
    {
        var rows = await _db.ContentPages
            .AsNoTracking()
            .OrderByDescending(c => c.UpdatedAt ?? c.CreatedAt)
            .Select(c => new
            {
                c.Id, c.Type, c.Slug, c.Topic, c.TitleKa, c.IsPublished, c.PublishedAt, c.UpdatedAt,
                PhotoCount = c.Photos.Count,
            })
            .ToListAsync();
        return Ok(rows.Select(c => new AdminContentRowDto(
            c.Id, ContentRules.Key(c.Type), c.Slug, c.Topic, c.TitleKa, c.IsPublished, c.PublishedAt,
            c.UpdatedAt, c.PhotoCount)));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<AdminContentDto>> Get(int id)
    {
        var page = await LoadAsync(id);
        return page is null ? NotFound() : Ok(ToDto(page));
    }

    [HttpPost]
    public async Task<ActionResult<AdminContentDto>> Create([FromBody] SaveContentDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (!ContentRules.TryParseType(dto.Type, out var type)) return Fail("invalid_type");

        var page = new ContentPage { Type = type, CreatedAt = DateTimeOffset.UtcNow };
        var error = await ApplyAsync(page, dto, isNew: true);
        if (error is not null) return error;

        _db.ContentPages.Add(page);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { id = page.Id }, ToDto(page));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<AdminContentDto>> Update(int id, [FromBody] SaveContentDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (!ContentRules.TryParseType(dto.Type, out var type)) return Fail("invalid_type");

        var page = await LoadAsync(id, tracking: true);
        if (page is null) return NotFound();
        if (page.Type != type) return Fail("type_locked"); // the URL section can't change under a published page

        var error = await ApplyAsync(page, dto, isNew: false);
        if (error is not null) return error;

        page.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(ToDto(page));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var page = await _db.ContentPages.Include(c => c.Photos).FirstOrDefaultAsync(c => c.Id == id);
        if (page is null) return NotFound();

        var storageIds = page.Photos.Select(p => p.StorageId).ToList();
        _db.ContentPages.Remove(page);
        await _db.SaveChangesAsync();

        // Blobs go after the commit (same reasoning as vendor photos: an orphaned blob is
        // recoverable garbage, a row pointing at a deleted blob is a broken page).
        foreach (var sid in storageIds) await DeleteBlobAsync(sid);
        return NoContent();
    }

    // ---------------------------------------------------------------- photos

    [HttpPost("{id:int}/photos")]
    [RequestSizeLimit(MaxBytes + 1024)]
    public async Task<ActionResult<ContentPhotoDto>> UploadPhoto(int id, IFormFile? file)
    {
        var page = await _db.ContentPages.FirstOrDefaultAsync(c => c.Id == id);
        if (page is null) return NotFound();

        if (file is null || file.Length == 0) return Fail("no_file");
        if (file.Length > MaxBytes) return Fail("file_too_large");
        if (!AllowedTypes.Contains(file.ContentType)) return Fail("file_type");

        // Content-Type and filename are client-controlled; the magic bytes decide.
        string? ext;
        await using (var sniff = file.OpenReadStream())
        {
            ext = await ImageSniffer.DetectExtensionAsync(sniff);
        }
        if (ext is null) return Fail("file_type");

        var count = await _db.ContentPhotos.CountAsync(p => p.ContentPageId == id);
        if (count >= MaxPhotos) return Fail("photo_limit");

        StoredPhoto stored;
        await using (var stream = file.OpenReadStream())
        {
            stored = await _storage.UploadAsync(stream, $"content{ext}");
        }

        var maxSort = await _db.ContentPhotos
            .Where(p => p.ContentPageId == id)
            .Select(p => (int?)p.SortOrder)
            .MaxAsync() ?? -1;

        // The title is a starting alt text; the editor asks for a real description.
        var photo = new ContentPhoto
        {
            ContentPageId = id,
            Url = stored.Url,
            StorageId = stored.StorageId,
            AltKa = page.TitleKa,
            SortOrder = maxSort + 1,
        };
        _db.ContentPhotos.Add(photo);
        page.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new ContentPhotoDto(photo.Id, photo.Url, photo.AltKa, photo.AltEn, photo.SortOrder));
    }

    [HttpPut("{id:int}/photos/{photoId:int}")]
    public async Task<IActionResult> UpdatePhoto(int id, int photoId, [FromBody] ContentPhotoAltDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        var photo = await _db.ContentPhotos.FirstOrDefaultAsync(p => p.Id == photoId && p.ContentPageId == id);
        if (photo is null) return NotFound();

        photo.AltKa = dto.AltKa.Trim();
        photo.AltEn = Clean(dto.AltEn);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>Full permutation of the page's photo ids; the first becomes the cover.</summary>
    [HttpPut("{id:int}/photos/order")]
    public async Task<IActionResult> ReorderPhotos(int id, [FromBody] ContentPhotoOrderDto dto)
    {
        var photos = await _db.ContentPhotos.Where(p => p.ContentPageId == id).ToListAsync();
        var ids = photos.Select(p => p.Id).ToHashSet();
        if (dto.Ids.Length != ids.Count || !dto.Ids.All(ids.Contains) || dto.Ids.Distinct().Count() != ids.Count)
            return Fail("order_mismatch");

        for (var i = 0; i < dto.Ids.Length; i++)
            photos.First(p => p.Id == dto.Ids[i]).SortOrder = i;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}/photos/{photoId:int}")]
    public async Task<IActionResult> DeletePhoto(int id, int photoId)
    {
        var photo = await _db.ContentPhotos.FirstOrDefaultAsync(p => p.Id == photoId && p.ContentPageId == id);
        if (photo is null) return NotFound();

        var page = await _db.ContentPages.Include(c => c.Photos).FirstAsync(c => c.Id == id);
        // A published gallery page must keep at least one photo.
        if (page.IsPublished && NeedsPhoto(page.Type) && page.Photos.Count <= 1)
            return Fail("photo_required");

        _db.ContentPhotos.Remove(photo);
        page.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();
        await DeleteBlobAsync(photo.StorageId);
        return NoContent();
    }

    // ---------------------------------------------------------------- helpers

    /// <summary>Validates and copies the DTO onto the page. Returns an error result, or null.</summary>
    private async Task<ActionResult?> ApplyAsync(ContentPage page, SaveContentDto dto, bool isNew)
    {
        var type = page.Type;
        var topic = Clean(dto.Topic);
        if (!ContentRules.IsValidTopic(type, topic)) return Fail("invalid_topic");

        // Slug: given → validated as-is; empty → made from the Georgian title (new pages only;
        // an existing page keeps its URL unless one is given explicitly).
        var slug = Clean(dto.Slug)?.ToLowerInvariant();
        if (slug is not null)
        {
            if (!SlugPattern.IsMatch(slug)) return Fail("invalid_slug");
            if (await _db.ContentPages.AnyAsync(c => c.Type == type && c.Slug == slug && c.Id != page.Id))
                return Fail("slug_taken", StatusCodes.Status409Conflict);
        }
        else if (isNew)
        {
            slug = await UniqueSlugAsync(type, Slugs.From(dto.TitleKa));
        }
        else
        {
            slug = page.Slug;
        }
        if (type == ContentPageType.Legal && !ContentRules.LegalSlugs.Contains(slug))
            return Fail("invalid_legal_slug");

        var actionPath = Clean(dto.ActionPath);
        var actionLabelKa = Clean(dto.ActionLabelKa);
        if (actionPath is not null && (!ContentRules.IsValidActionPath(actionPath) || actionLabelKa is null))
            return Fail("invalid_action");

        // Credits: only real weddings carry them. Vendor ids must exist; the name defaults to theirs.
        var credits = new List<ContentCredit>();
        if (type == ContentPageType.RealWedding && dto.Credits is { Count: > 0 })
        {
            var vendorIds = dto.Credits.Where(c => c.VendorId is not null).Select(c => c.VendorId!.Value).Distinct().ToList();
            var vendors = await _db.Vendors.Where(v => vendorIds.Contains(v.Id))
                .Select(v => new { v.Id, v.Name }).ToDictionaryAsync(v => v.Id, v => v.Name);
            for (var i = 0; i < dto.Credits.Count; i++)
            {
                var c = dto.Credits[i];
                string? vendorName = null;
                if (c.VendorId is int vid && !vendors.TryGetValue(vid, out vendorName))
                    return Fail("unknown_vendor");
                var name = Clean(c.Name) ?? vendorName;
                if (name is null || string.IsNullOrWhiteSpace(c.RoleKa)) return Fail("invalid_credit");
                credits.Add(new ContentCredit
                {
                    VendorId = c.VendorId,
                    Name = name,
                    RoleKa = c.RoleKa.Trim(),
                    RoleEn = Clean(c.RoleEn),
                    SortOrder = i,
                });
            }
        }

        var bodyKa = Clean(dto.BodyKa);
        var consent = Clean(dto.ConsentNote);
        if (dto.IsPublished)
        {
            if ((type is ContentPageType.Article or ContentPageType.Legal) && bodyKa is null)
                return Fail("body_required");
            if (type == ContentPageType.RealWedding && consent is null)
                return Fail("consent_required");
            if (NeedsPhoto(type))
            {
                var photoCount = isNew ? 0 : await _db.ContentPhotos.CountAsync(p => p.ContentPageId == page.Id);
                if (photoCount == 0) return Fail("photo_required");
            }
        }

        page.Slug = slug!;
        page.Topic = topic;
        page.TitleKa = dto.TitleKa.Trim();
        page.TitleEn = Clean(dto.TitleEn);
        page.ExcerptKa = Clean(dto.ExcerptKa);
        page.ExcerptEn = Clean(dto.ExcerptEn);
        page.BodyKa = bodyKa;
        page.BodyEn = Clean(dto.BodyEn);
        page.MetaDescriptionKa = Clean(dto.MetaDescriptionKa);
        page.MetaDescriptionEn = Clean(dto.MetaDescriptionEn);
        page.ActionPath = actionPath;
        page.ActionLabelKa = actionPath is null ? null : actionLabelKa;
        page.ActionLabelEn = actionPath is null ? null : Clean(dto.ActionLabelEn);
        page.ConsentNote = consent;
        page.IsPublished = dto.IsPublished;
        if (dto.IsPublished && page.PublishedAt is null)
            page.PublishedAt = DateTimeOffset.UtcNow;

        if (!isNew) _db.ContentCredits.RemoveRange(page.Credits);
        page.Credits = credits;
        return null;
    }

    private async Task<string> UniqueSlugAsync(ContentPageType type, string baseSlug)
    {
        if (string.IsNullOrEmpty(baseSlug)) baseSlug = "page";
        var taken = await _db.ContentPages
            .Where(c => c.Type == type && (c.Slug == baseSlug || c.Slug.StartsWith(baseSlug + "-")))
            .Select(c => c.Slug)
            .ToListAsync();
        if (!taken.Contains(baseSlug)) return baseSlug;
        for (var n = 2; ; n++)
        {
            var candidate = $"{baseSlug}-{n}";
            if (!taken.Contains(candidate)) return candidate;
        }
    }

    private static bool NeedsPhoto(ContentPageType type) =>
        type is ContentPageType.Inspiration or ContentPageType.RealWedding;

    private Task<ContentPage?> LoadAsync(int id, bool tracking = false)
    {
        IQueryable<ContentPage> q = _db.ContentPages.Include(c => c.Photos).Include(c => c.Credits).AsSplitQuery();
        if (!tracking) q = q.AsNoTracking();
        return q.FirstOrDefaultAsync(c => c.Id == id);
    }

    private static AdminContentDto ToDto(ContentPage c) => new(
        c.Id,
        ContentRules.Key(c.Type),
        c.Slug,
        c.Topic,
        c.TitleKa,
        c.TitleEn,
        c.ExcerptKa,
        c.ExcerptEn,
        c.BodyKa,
        c.BodyEn,
        c.MetaDescriptionKa,
        c.MetaDescriptionEn,
        c.ActionPath,
        c.ActionLabelKa,
        c.ActionLabelEn,
        c.ConsentNote,
        c.IsPublished,
        c.PublishedAt,
        c.CreatedAt,
        c.UpdatedAt,
        c.Photos.OrderBy(p => p.SortOrder).ThenBy(p => p.Id)
            .Select(p => new ContentPhotoDto(p.Id, p.Url, p.AltKa, p.AltEn, p.SortOrder)).ToList(),
        c.Credits.OrderBy(cr => cr.SortOrder)
            .Select(cr => new AdminCreditDto(cr.VendorId, cr.Name, cr.RoleKa, cr.RoleEn)).ToList(),
        ContentRules.PublicPath(c.Type, c.Slug));

    private ObjectResult Fail(string code, int status = StatusCodes.Status400BadRequest) =>
        StatusCode(status, new { code });

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private async Task DeleteBlobAsync(string? storageId)
    {
        try
        {
            await _storage.DeleteAsync(storageId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Orphaned content photo blob {StorageId} could not be deleted.", storageId);
        }
    }
}
