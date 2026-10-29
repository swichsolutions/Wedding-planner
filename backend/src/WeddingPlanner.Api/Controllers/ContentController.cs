using WeddingPlanner.Api.Dtos;
using WeddingPlanner.Domain.Entities;
using WeddingPlanner.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace WeddingPlanner.Api.Controllers;

/// <summary>
/// Public read side of "რჩევები და იდეები" and the legal pages. Published pages only;
/// drafts are invisible here (they 404 like a missing page).
/// </summary>
[ApiController]
[Route("api/content")]
public class ContentController : ControllerBase
{
    private const int DefaultLimit = 24;
    private const int MaxLimit = 100;
    private const int RelatedCount = 3;

    private readonly AppDbContext _db;

    public ContentController(AppDbContext db) => _db = db;

    /// <summary>Newest first. Without a type: articles, inspiration and real weddings together (never legal).</summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<ContentSummaryDto>>> List(
        [FromQuery] string? type, [FromQuery] string? topic, [FromQuery] int? limit)
    {
        var query = _db.ContentPages.AsNoTracking().Where(c => c.IsPublished);
        if (type is not null)
        {
            if (!ContentRules.TryParseType(type, out var t)) return BadRequest(new { code = "invalid_type" });
            query = query.Where(c => c.Type == t);
        }
        else
        {
            query = query.Where(c => c.Type != ContentPageType.Legal);
        }
        if (!string.IsNullOrWhiteSpace(topic))
            query = query.Where(c => c.Topic == topic);

        var take = Math.Clamp(limit ?? DefaultLimit, 1, MaxLimit);
        var rows = await query
            .OrderByDescending(c => c.PublishedAt).ThenByDescending(c => c.Id)
            .Take(take)
            .Select(SummaryProjection)
            .ToListAsync();
        return Ok(rows.Select(ToSummary));
    }

    [HttpGet("{type}/{slug}")]
    public async Task<ActionResult<ContentDetailDto>> Get(string type, string slug)
    {
        if (!ContentRules.TryParseType(type, out var t)) return NotFound();

        var page = await _db.ContentPages
            .AsNoTracking()
            .Include(c => c.Photos)
            .Include(c => c.Credits).ThenInclude(cr => cr.Vendor!).ThenInclude(v => v.Category)
            .AsSplitQuery()
            .FirstOrDefaultAsync(c => c.Type == t && c.Slug == slug && c.IsPublished);
        if (page is null) return NotFound();

        var photos = page.Photos
            .OrderBy(p => p.SortOrder).ThenBy(p => p.Id)
            .Select(p => new ContentPhotoDto(p.Id, p.Url, p.AltKa, p.AltEn, p.SortOrder))
            .ToList();
        var cover = photos.FirstOrDefault();

        var credits = page.Credits
            .OrderBy(c => c.SortOrder)
            .Select(c => new ContentCreditDto(
                c.Name,
                c.RoleKa,
                c.RoleEn,
                c.Vendor is { IsApproved: true } v && v.CitySlug != ""
                    ? $"/{v.Category.Slug}/{v.CitySlug}/{v.Slug}"
                    : null))
            .ToList();

        // Same section; same topic first. Legal pages have no "related".
        var related = new List<ContentSummaryDto>();
        if (t != ContentPageType.Legal)
        {
            var rows = await _db.ContentPages
                .AsNoTracking()
                .Where(c => c.IsPublished && c.Type == t && c.Id != page.Id)
                .OrderByDescending(c => page.Topic != null && c.Topic == page.Topic)
                .ThenByDescending(c => c.PublishedAt)
                .Take(RelatedCount)
                .Select(SummaryProjection)
                .ToListAsync();
            related.AddRange(rows.Select(ToSummary));
        }

        var summary = new ContentSummaryDto(
            page.Slug, ContentRules.Key(page.Type), page.Topic, page.TitleKa, page.TitleEn,
            page.ExcerptKa, page.ExcerptEn, cover?.Url, cover?.AltKa, cover?.AltEn, page.PublishedAt);

        return Ok(new ContentDetailDto(
            summary,
            page.BodyKa,
            page.BodyEn,
            page.MetaDescriptionKa,
            page.MetaDescriptionEn,
            page.ActionPath,
            page.ActionLabelKa,
            page.ActionLabelEn,
            page.UpdatedAt,
            photos,
            credits,
            related));
    }

    // Projection the database can run; the cover is the lowest-SortOrder photo.
    private static readonly System.Linq.Expressions.Expression<Func<ContentPage, SummaryRow>> SummaryProjection =
        c => new SummaryRow(
            c.Slug, c.Type, c.Topic, c.TitleKa, c.TitleEn, c.ExcerptKa, c.ExcerptEn,
            c.Photos.OrderBy(p => p.SortOrder).ThenBy(p => p.Id).Select(p => p.Url).FirstOrDefault(),
            c.Photos.OrderBy(p => p.SortOrder).ThenBy(p => p.Id).Select(p => p.AltKa).FirstOrDefault(),
            c.Photos.OrderBy(p => p.SortOrder).ThenBy(p => p.Id).Select(p => p.AltEn).FirstOrDefault(),
            c.PublishedAt);

    private static ContentSummaryDto ToSummary(SummaryRow r) => new(
        r.Slug, ContentRules.Key(r.Type), r.Topic, r.TitleKa, r.TitleEn, r.ExcerptKa, r.ExcerptEn,
        r.CoverUrl, r.CoverAltKa, r.CoverAltEn, r.PublishedAt);

    private record SummaryRow(
        string Slug, ContentPageType Type, string? Topic, string TitleKa, string? TitleEn,
        string? ExcerptKa, string? ExcerptEn, string? CoverUrl, string? CoverAltKa, string? CoverAltEn,
        DateTimeOffset? PublishedAt);
}
