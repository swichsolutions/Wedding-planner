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
/// Photos the couple marks for their wedding (B7): décor, flowers, cake and tables from vendor
/// portfolios and inspiration ideas. The overview banner lays them out. Only photos already on the
/// site can be marked (by id), never an outside URL. Shared by both partners.
/// </summary>
[ApiController]
[Route("api/planning/photos")]
[Authorize(Roles = Roles.Couple)]
public class PlanPhotosController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly CoupleScope _couple;

    public PlanPhotosController(AppDbContext db, CoupleScope couple)
    {
        _db = db;
        _couple = couple;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<PlanPhotoDto>>> List()
    {
        if (await _couple.IdAsync() is not int cid) return Forbid();
        return Ok(await ListAsync(_db, cid, int.MaxValue));
    }

    /// <summary>Mark a photo; marking one twice is fine. Returns the whole list.</summary>
    [HttpPost]
    public async Task<ActionResult<IEnumerable<PlanPhotoDto>>> Mark([FromBody] PlanPhotoMarkDto dto)
    {
        if (await _couple.IdAsync() is not int cid) return Forbid();
        if ((dto.VendorPhotoId is null) == (dto.ContentPhotoId is null)) return BadRequest();

        var already = await _db.PlanPhotos.AnyAsync(p => p.CoupleId == cid
            && (dto.VendorPhotoId != null ? p.VendorPhotoId == dto.VendorPhotoId : p.ContentPhotoId == dto.ContentPhotoId));
        if (already) return Ok(await ListAsync(_db, cid, int.MaxValue));
        if (await _db.PlanPhotos.CountAsync(p => p.CoupleId == cid) >= BannerRules.MaxPhotos)
            return Conflict(new { code = "full" });

        var photo = new PlanPhoto { CoupleId = cid, CreatedAt = DateTimeOffset.UtcNow };
        if (dto.VendorPhotoId is int vpid)
        {
            var source = await _db.VendorPhotos.AsNoTracking()
                .Where(p => p.Id == vpid && p.Vendor.IsApproved)
                .Select(p => new { p.Url, Category = p.Vendor.Category.Slug })
                .FirstOrDefaultAsync();
            if (source is null) return NotFound();
            if (BannerRules.KindForCategory(source.Category) is not string kind) return BadRequest(new { code = "kind" });
            photo.Kind = kind;
            photo.Url = source.Url;
            photo.VendorPhotoId = vpid;
        }
        else
        {
            var source = await _db.ContentPhotos.AsNoTracking()
                .Where(p => p.Id == dto.ContentPhotoId && p.ContentPage.IsPublished
                    && p.ContentPage.Type == ContentPageType.Inspiration)
                .Select(p => new { p.Url, p.ContentPage.Topic })
                .FirstOrDefaultAsync();
            if (source is null) return NotFound();
            if (BannerRules.KindForTopic(source.Topic) is not string kind) return BadRequest(new { code = "kind" });
            photo.Kind = kind;
            photo.Url = source.Url;
            photo.ContentPhotoId = dto.ContentPhotoId;
        }

        _db.PlanPhotos.Add(photo);
        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (DbErrors.IsUniqueViolation(ex))
        {
            // The partner marked the same photo a moment earlier: it's marked either way.
        }
        return Ok(await ListAsync(_db, cid, int.MaxValue));
    }

    [HttpDelete("{id:int}")]
    public async Task<ActionResult<IEnumerable<PlanPhotoDto>>> Unmark(int id)
    {
        if (await _couple.IdAsync() is not int cid) return Forbid();
        var removed = await _db.PlanPhotos.Where(p => p.Id == id && p.CoupleId == cid).ExecuteDeleteAsync();
        if (removed == 0) return NotFound();
        return Ok(await ListAsync(_db, cid, int.MaxValue));
    }

    /// <summary>Newest first, with the page each photo came from.</summary>
    public static async Task<List<PlanPhotoDto>> ListAsync(AppDbContext db, int cid, int take)
    {
        var rows = await db.PlanPhotos.AsNoTracking()
            .Where(p => p.CoupleId == cid)
            .OrderByDescending(p => p.CreatedAt).ThenByDescending(p => p.Id)
            .Take(take)
            .Select(p => new
            {
                p.Id, p.Url, p.Kind, p.VendorPhotoId, p.ContentPhotoId,
                VendorName = p.VendorPhoto != null ? p.VendorPhoto.Vendor.Name : null,
                VendorCategory = p.VendorPhoto != null ? p.VendorPhoto.Vendor.Category.Slug : null,
                VendorCity = p.VendorPhoto != null ? p.VendorPhoto.Vendor.CitySlug : null,
                VendorSlug = p.VendorPhoto != null ? p.VendorPhoto.Vendor.Slug : null,
                TitleKa = p.ContentPhoto != null ? p.ContentPhoto.ContentPage.TitleKa : null,
                TitleEn = p.ContentPhoto != null ? p.ContentPhoto.ContentPage.TitleEn : null,
                ContentSlug = p.ContentPhoto != null ? p.ContentPhoto.ContentPage.Slug : null,
            })
            .ToListAsync();

        return rows.Select(r => new PlanPhotoDto(
            r.Id, r.Url, r.Kind, r.VendorPhotoId, r.ContentPhotoId,
            r.VendorName ?? r.TitleKa,
            r.VendorName ?? r.TitleEn,
            r.VendorSlug is not null && !string.IsNullOrEmpty(r.VendorCity)
                ? $"/{r.VendorCategory}/{r.VendorCity}/{r.VendorSlug}"
                : r.ContentSlug is not null ? ContentRules.PublicPath(ContentPageType.Inspiration, r.ContentSlug) : null))
            .ToList();
    }
}
