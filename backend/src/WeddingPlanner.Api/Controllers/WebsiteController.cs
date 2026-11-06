using System.Text;
using System.Text.RegularExpressions;
using WeddingPlanner.Api.Auth;
using WeddingPlanner.Api.Dtos;
using WeddingPlanner.Api.Planning;
using WeddingPlanner.Domain.Entities;
using WeddingPlanner.Infrastructure.Data;
using WeddingPlanner.Infrastructure.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace WeddingPlanner.Api.Controllers;

/// <summary>
/// The couple's invitation (B6, grown from the wedding-website builder, D7): design, details,
/// places, extras, RSVP, publish to a public /w/{slug} URL, personal links per family. One per plan.
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
    /// <summary>The shared plan this request works on (both partners see the same rows).</summary>
    private readonly CoupleScope _couple;
    private readonly IPhotoStorage _storage;
    private readonly ILogger<WebsiteController> _logger;

    public WebsiteController(AppDbContext db, CoupleScope couple, IPhotoStorage storage, ILogger<WebsiteController> logger)
    {
        _db = db;
        _couple = couple;
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

    /// <summary>The plan's site with its schedule and photos, tracked; null when not created yet.</summary>
    private Task<WeddingSite?> LoadAsync(int cid) =>
        _db.WeddingSites
            .Include(s => s.Schedule)
            .Include(s => s.Photos)
            .AsSplitQuery()
            .FirstOrDefaultAsync(s => s.CoupleId == cid);

    [HttpGet]
    public async Task<ActionResult<WeddingSiteDto>> Get()
    {
        if (await _couple.IdAsync() is not int cid) return Forbid();
        var site = await LoadAsync(cid);
        if (site is null) return NoContent(); // not created yet — the builder starts at design pick
        return Ok(Map(site));
    }

    [HttpPut]
    public async Task<ActionResult<WeddingSiteDto>> Upsert([FromBody] WeddingSiteUpdateDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (await _couple.IdAsync() is not int cid) return Forbid();
        if (!TemplateKeys.Contains(dto.TemplateKey)) return BadRequest("Unknown template.");
        var fontKey = Clean(dto.FontKey);
        if (fontKey is not null && !InviteRules.FontKeys.Contains(fontKey)) return BadRequest("Unknown font.");
        var ceremonyMap = Clean(dto.CeremonyMapUrl);
        var receptionMap = Clean(dto.ReceptionMapUrl);
        if ((ceremonyMap is not null && !InviteRules.IsWebLink(ceremonyMap))
            || (receptionMap is not null && !InviteRules.IsWebLink(receptionMap)))
            return BadRequest(new { code = "mapUrl" });

        var site = await LoadAsync(cid);
        if (site is null)
        {
            site = new WeddingSite { CoupleId = cid, CreatedAt = DateTimeOffset.UtcNow };
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
        site.StartTime = Clean(dto.StartTime);
        site.FontKey = fontKey;
        site.CeremonyName = Clean(dto.CeremonyName);
        site.CeremonyAddress = Clean(dto.CeremonyAddress);
        site.CeremonyTime = Clean(dto.CeremonyTime);
        site.CeremonyMapUrl = ceremonyMap;
        site.ReceptionName = Clean(dto.ReceptionName);
        site.ReceptionAddress = Clean(dto.ReceptionAddress);
        site.ReceptionTime = Clean(dto.ReceptionTime);
        site.ReceptionMapUrl = receptionMap;
        site.DressCode = Clean(dto.DressCode);
        site.Transport = Clean(dto.Transport);
        site.Accommodation = Clean(dto.Accommodation);
        if (dto.Schedule is not null)
        {
            // Replaced whole: removed lines are orphans of a required relationship, so EF deletes them.
            site.Schedule.Clear();
            var order = 0;
            foreach (var line in dto.Schedule)
            {
                var text = Clean(line.Text);
                if (text is null) continue;
                site.Schedule.Add(new WeddingSiteScheduleItem { Time = Clean(line.Time), Text = text, SortOrder = order++ });
            }
        }
        site.RsvpEnabled = dto.RsvpEnabled ?? site.RsvpEnabled;
        site.RsvpDeadline = dto.RsvpDeadline;
        site.RsvpAskDiet = dto.RsvpAskDiet ?? site.RsvpAskDiet;
        site.RsvpAskMessage = dto.RsvpAskMessage ?? site.RsvpAskMessage;
        site.RsvpQuestion = Clean(dto.RsvpQuestion);
        site.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(Map(site));
    }

    /// <summary>Checks an uploaded image and stores it; the error is the response to send when it
    /// can't be stored.</summary>
    private async Task<(StoredPhoto? Stored, ActionResult? Error)> StoreAsync(IFormFile? file)
    {
        if (file is null || file.Length == 0) return (null, BadRequest("No file provided."));
        if (file.Length > MaxPhotoBytes) return (null, BadRequest("File too large (max 8 MB)."));
        if (!AllowedPhotoTypes.Contains(file.ContentType))
            return (null, BadRequest("Unsupported file type. Use JPG, PNG, or WebP."));

        // Content-Type and filename are client-controlled; only the magic bytes decide
        // whether this is stored (and which extension it's served with).
        string? ext;
        await using (var sniff = file.OpenReadStream())
        {
            ext = await ImageSniffer.DetectExtensionAsync(sniff);
        }
        if (ext is null)
            return (null, BadRequest("Unsupported file type. Use JPG, PNG, or WebP."));

        await using var stream = file.OpenReadStream();
        return (await _storage.UploadAsync(stream, $"photo{ext}"), null);
    }

    [HttpPost("photo")]
    [RequestSizeLimit(MaxPhotoBytes + 1024)]
    public async Task<ActionResult<WeddingSiteDto>> UploadPhoto(IFormFile? file)
    {
        if (await _couple.IdAsync() is not int cid) return Forbid();
        var site = await LoadAsync(cid);
        if (site is null) return NotFound();

        var (stored, error) = await StoreAsync(file);
        if (stored is null) return error!;

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
        if (await _couple.IdAsync() is not int cid) return Forbid();
        var site = await LoadAsync(cid);
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

    /// <summary>One more photo for the invitation's gallery (up to six).</summary>
    [HttpPost("photos")]
    [RequestSizeLimit(MaxPhotoBytes + 1024)]
    public async Task<ActionResult<WeddingSiteDto>> AddPhoto(IFormFile? file)
    {
        if (await _couple.IdAsync() is not int cid) return Forbid();
        var site = await LoadAsync(cid);
        if (site is null) return NotFound();
        if (site.Photos.Count >= InviteRules.MaxPhotos) return Conflict(new { code = "full" });

        var (stored, error) = await StoreAsync(file);
        if (stored is null) return error!;

        site.Photos.Add(new WeddingSitePhoto
        {
            Url = stored.Url,
            StorageId = stored.StorageId,
            SortOrder = site.Photos.Count == 0 ? 0 : site.Photos.Max(p => p.SortOrder) + 1,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        site.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(Map(site));
    }

    [HttpDelete("photos/{id:int}")]
    public async Task<ActionResult<WeddingSiteDto>> RemoveGalleryPhoto(int id)
    {
        if (await _couple.IdAsync() is not int cid) return Forbid();
        var site = await LoadAsync(cid);
        if (site is null) return NotFound();
        var photo = site.Photos.FirstOrDefault(p => p.Id == id);
        if (photo is null) return NotFound();

        site.Photos.Remove(photo);
        site.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();
        await TryDeleteBlobAsync(photo.StorageId);
        return Ok(Map(site));
    }

    /// <summary>
    /// Who gets a personal link (D9): every family with guests, and every guest invited outside a
    /// family. Codes are handed out here the first time, so guests added any way (by hand, the
    /// guest list, an import) get one. Only this party's names and answers show on its link.
    /// </summary>
    [HttpGet("parties")]
    public async Task<ActionResult<IEnumerable<InviteePartyDto>>> Parties()
    {
        if (await _couple.IdAsync() is not int cid) return Forbid();

        // Set only where still empty, so two partners opening this at once can't hand out two
        // different links for the same family.
        var familiesWithout = await _db.GuestFamilies
            .Where(f => f.CoupleId == cid && f.InviteCode == null).Select(f => f.Id).ToListAsync();
        foreach (var id in familiesWithout)
        {
            var code = InviteRules.NewCode();
            await _db.GuestFamilies.Where(f => f.Id == id && f.InviteCode == null)
                .ExecuteUpdateAsync(u => u.SetProperty(f => f.InviteCode, code));
        }
        var guestsWithout = await _db.Guests
            .Where(g => g.CoupleId == cid && g.FamilyId == null && g.InviteCode == null).Select(g => g.Id).ToListAsync();
        foreach (var id in guestsWithout)
        {
            var code = InviteRules.NewCode();
            await _db.Guests.Where(g => g.Id == id && g.InviteCode == null)
                .ExecuteUpdateAsync(u => u.SetProperty(g => g.InviteCode, code));
        }

        var families = await _db.GuestFamilies.AsNoTracking()
            .Where(f => f.CoupleId == cid).OrderBy(f => f.Name).ToListAsync();
        var guests = await _db.Guests.AsNoTracking()
            .Where(g => g.CoupleId == cid).OrderBy(g => g.SortOrder).ToListAsync();

        static int People(Guest g) => 1 + (g.HasPlusOne ? 1 : 0) + (g.HasChild ? 1 : 0);
        var parties = new List<InviteePartyDto>();
        foreach (var f in families)
        {
            var members = guests.Where(g => g.FamilyId == f.Id).ToList();
            if (members.Count == 0 || f.InviteCode is null) continue;
            parties.Add(new InviteePartyDto(
                "family", f.Id, f.Name, members.Sum(People), f.InviteCode,
                members.Count(g => g.Attendance == "yes"), members.Count(g => g.Attendance == "no"),
                members.Count(g => g.Attendance == "pending"), f.RsvpAt));
        }
        foreach (var g in guests.Where(g => g.FamilyId == null && g.InviteCode != null))
        {
            parties.Add(new InviteePartyDto(
                "guest", g.Id, $"{g.FirstName} {g.LastName}".Trim(), People(g), g.InviteCode!,
                g.Attendance == "yes" ? 1 : 0, g.Attendance == "no" ? 1 : 0, g.Attendance == "pending" ? 1 : 0,
                g.RsvpAt));
        }
        return Ok(parties);
    }

    [HttpPost("publish")]
    public async Task<ActionResult<WeddingSiteDto>> Publish()
    {
        if (await _couple.IdAsync() is not int cid) return Forbid();
        var site = await LoadAsync(cid);
        if (site is null) return NotFound();
        if (string.IsNullOrWhiteSpace(site.FirstName) || string.IsNullOrWhiteSpace(site.PartnerFirstName) || site.WeddingDate is null)
            return BadRequest(new { code = "incomplete" });

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
        if (await _couple.IdAsync() is not int cid) return Forbid();
        var site = await LoadAsync(cid);
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
            s.PhotoUrl, s.PhotoFocusX, s.PhotoFocusY, s.IsPublished, s.Slug,
            s.StartTime, s.FontKey,
            s.CeremonyName, s.CeremonyAddress, s.CeremonyTime, s.CeremonyMapUrl,
            s.ReceptionName, s.ReceptionAddress, s.ReceptionTime, s.ReceptionMapUrl,
            s.DressCode, s.Transport, s.Accommodation,
            ScheduleOf(s), PhotosOf(s),
            s.RsvpEnabled, s.RsvpDeadline, s.RsvpAskDiet, s.RsvpAskMessage, s.RsvpQuestion);

    public static IReadOnlyList<SiteScheduleItemDto> ScheduleOf(WeddingSite s) =>
        s.Schedule.OrderBy(x => x.SortOrder).Select(x => new SiteScheduleItemDto(x.Time, x.Text)).ToList();

    public static IReadOnlyList<SitePhotoDto> PhotosOf(WeddingSite s) =>
        s.Photos.OrderBy(x => x.SortOrder).Select(x => new SitePhotoDto(x.Id, x.Url)).ToList();

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
