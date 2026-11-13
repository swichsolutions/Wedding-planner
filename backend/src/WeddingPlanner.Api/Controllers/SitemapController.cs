using System.Text;
using WeddingPlanner.Domain.Entities;
using WeddingPlanner.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace WeddingPlanner.Api.Controllers;

/// <summary>
/// sitemap.xml generated from REAL data, with the site's addresses of 2026-11-13
/// (<see cref="SiteAddresses"/>): the home page, the catalog, one URL per catalog group, per
/// category and per category×city pairing that actually has approved vendors (an empty one is
/// noindex or a 404 on the site), and one per approved vendor profile. Then the pages that are
/// always there: the example day schedules, the couples' tools and the company pages. Published
/// editorial pages are listed too: articles, inspiration, real weddings (plus the hub and each
/// non-empty section) and the legal pages. Signed-in and personal pages are deliberately absent.
/// Search engines read it at the site's own /sitemap.xml: the live Worker fetches it from here
/// (frontend/src/server.edge.ts); behind a reverse proxy, route /sitemap.xml to the API alongside
/// /api and /uploads (CLAUDE.md §10). A lastmod only where a real date exists, since a
/// fabricated one is worse than none: a vendor page's is the newer of the vendor's CreatedAt (a
/// vendor carries no UpdatedAt) and its newest review; a catalog or landing page takes the newest
/// of the vendors it lists; an editorial page its UpdatedAt ?? PublishedAt, its section the newest
/// of its pages. The home page, the schedules, the tools and the company pages have none.
/// </summary>
[ApiController]
public class SitemapController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;

    public SitemapController(AppDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    [HttpGet("/sitemap.xml")]
    public async Task<IActionResult> Get()
    {
        // Site:PublicOrigin pins the canonical origin in production; the request
        // origin is the dev fallback (behind the proxy the forwarded scheme/host
        // apply once ForwardedHeaders:TrustedProxies is configured).
        var origin = _config["Site:PublicOrigin"]?.TrimEnd('/')
                     ?? $"{Request.Scheme}://{Request.Host}";

        // One pass: the vendor slugs are the page list, and the distinct groups, categories
        // and (category, city) prefixes of the same rows are the catalog and landing pages.
        var vendors = await _db.Vendors
            .AsNoTracking()
            .Where(v => v.IsApproved && v.CitySlug != "" && v.City != "")
            .Select(v => new
            {
                CategorySlug = v.Category.Slug,
                v.Category.GroupKey,
                v.CitySlug,
                v.Slug,
                v.CreatedAt,
                LastReview = v.Reviews.Max(r => (DateTimeOffset?)(r.UpdatedAt ?? r.CreatedAt)),
            })
            .OrderBy(v => v.CategorySlug).ThenBy(v => v.CitySlug).ThenBy(v => v.Slug)
            .ToListAsync();
        // a vendor page last changed when the vendor joined or a review was written or edited
        var listed = vendors
            .Select(v => (v.GroupKey, v.CategorySlug, v.CitySlug, v.Slug,
                          At: v.LastReview > v.CreatedAt ? v.LastReview.Value : v.CreatedAt))
            .ToList();

        var sb = new StringBuilder();
        sb.Append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        sb.Append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");

        AppendUrl(sb, $"{origin}/");
        AppendUrl(sb, $"{origin}/vendors", Newest(listed.Select(v => v.At)));
        // A group's and a category's own page (/foto-da-video, /fotografi), in the catalog's
        // order, once it has a vendor. Only today's categories: a retired one has no page.
        foreach (var group in CategoryCatalog.Groups)
        {
            var inGroup = listed.Where(v => v.GroupKey == group).ToList();
            if (inGroup.Count > 0 && SiteAddresses.GroupSlugs.TryGetValue(group, out var groupSlug))
                AppendUrl(sb, $"{origin}/{groupSlug}", Newest(inGroup.Select(v => v.At)));
        }
        foreach (var category in CategoryCatalog.Categories)
        {
            var inCategory = listed.Where(v => v.CategorySlug == category.Slug).ToList();
            if (inCategory.Count > 0)
                AppendUrl(sb, $"{origin}/{category.Slug}", Newest(inCategory.Select(v => v.At)));
        }
        foreach (var p in listed.GroupBy(v => (v.CategorySlug, v.CitySlug)))
            AppendUrl(sb, $"{origin}/{p.Key.CategorySlug}/{p.Key.CitySlug}", Newest(p.Select(v => v.At)));
        foreach (var v in listed)
            AppendUrl(sb, $"{origin}/{v.CategorySlug}/{v.CitySlug}/{v.Slug}", v.At);

        // Pages that are always there: the example day schedules (each has its own page), what
        // the couples' tools do, and the company pages.
        AppendUrl(sb, $"{origin}{SiteAddresses.Schedules}");
        foreach (var schedule in SiteAddresses.ScheduleSlugs)
            AppendUrl(sb, $"{origin}{SiteAddresses.Schedules}/{schedule}");
        foreach (var page in new[] { "/planning", "/budget", "/guests", "/seating", "/invitations", "/for-vendors", "/about", "/contact" })
            AppendUrl(sb, $"{origin}{page}");

        // Editorial pages: the hub and each section only once something is published in them
        // (empty ones are noindex on the site), then every published page: articles, ideas and
        // stories at their section's address, the legal pages at /terms and /privacy.
        var content = await _db.ContentPages
            .AsNoTracking()
            .Where(c => c.IsPublished)
            .OrderBy(c => c.Type).ThenByDescending(c => c.PublishedAt)
            .Select(c => new { c.Type, c.Slug, At = c.UpdatedAt ?? c.PublishedAt })
            .ToListAsync();
        var sections = new Dictionary<ContentPageType, string>
        {
            [ContentPageType.Article] = SiteAddresses.Blog,
            [ContentPageType.Inspiration] = SiteAddresses.Inspiration,
            [ContentPageType.RealWedding] = SiteAddresses.RealWeddings,
        };
        var editorial = content.Where(c => sections.ContainsKey(c.Type)).ToList();
        if (editorial.Count > 0)
            AppendUrl(sb, $"{origin}{SiteAddresses.Guides}", Newest(editorial.Select(c => c.At)));
        foreach (var (type, path) in sections)
        {
            var inSection = content.Where(c => c.Type == type).ToList();
            if (inSection.Count > 0)
                AppendUrl(sb, $"{origin}{path}", Newest(inSection.Select(c => c.At)));
        }
        foreach (var c in content)
            AppendUrl(sb, $"{origin}{ContentRules.PublicPath(c.Type, c.Slug)}", c.At);

        sb.Append("</urlset>\n");
        return Content(sb.ToString(), "application/xml", Encoding.UTF8);
    }

    /// <summary>The latest of some dates, or null when none of them is known.</summary>
    private static DateTimeOffset? Newest(IEnumerable<DateTimeOffset?> dates) => dates.Max();

    private static DateTimeOffset? Newest(IEnumerable<DateTimeOffset> dates) =>
        dates.Select(d => (DateTimeOffset?)d).Max();

    private static void AppendUrl(StringBuilder sb, string loc, DateTimeOffset? lastmod = null)
    {
        sb.Append("  <url><loc>").Append(System.Security.SecurityElement.Escape(loc)).Append("</loc>");
        // a W3C date (the UTC day): the day is all a search engine needs
        if (lastmod is { } at)
            sb.Append("<lastmod>").Append(at.UtcDateTime.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture)).Append("</lastmod>");
        sb.Append("</url>\n");
    }
}
