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
/// /api and /uploads (CLAUDE.md §10). No lastmod: vendors don't carry an UpdatedAt, and a
/// fabricated timestamp is worse than none.
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
            .Select(v => new { CategorySlug = v.Category.Slug, v.Category.GroupKey, v.CitySlug, v.Slug })
            .OrderBy(v => v.CategorySlug).ThenBy(v => v.CitySlug).ThenBy(v => v.Slug)
            .ToListAsync();

        var sb = new StringBuilder();
        sb.Append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        sb.Append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");

        AppendUrl(sb, $"{origin}/");
        AppendUrl(sb, $"{origin}/vendors");
        // A group's and a category's own page (/foto-da-video, /fotografi), in the catalog's
        // order, once it has a vendor. Only today's categories: a retired one has no page.
        var groupsInUse = vendors.Select(v => v.GroupKey).ToHashSet();
        foreach (var group in CategoryCatalog.Groups)
            if (groupsInUse.Contains(group) && SiteAddresses.GroupSlugs.TryGetValue(group, out var groupSlug))
                AppendUrl(sb, $"{origin}/{groupSlug}");
        var categoriesInUse = vendors.Select(v => v.CategorySlug).ToHashSet();
        foreach (var category in CategoryCatalog.Categories)
            if (categoriesInUse.Contains(category.Slug))
                AppendUrl(sb, $"{origin}/{category.Slug}");
        foreach (var p in vendors.Select(v => (v.CategorySlug, v.CitySlug)).Distinct())
            AppendUrl(sb, $"{origin}/{p.CategorySlug}/{p.CitySlug}");
        foreach (var v in vendors)
            AppendUrl(sb, $"{origin}/{v.CategorySlug}/{v.CitySlug}/{v.Slug}");

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
            .Select(c => new { c.Type, c.Slug })
            .ToListAsync();
        var sections = new Dictionary<ContentPageType, string>
        {
            [ContentPageType.Article] = SiteAddresses.Blog,
            [ContentPageType.Inspiration] = SiteAddresses.Inspiration,
            [ContentPageType.RealWedding] = SiteAddresses.RealWeddings,
        };
        if (content.Any(c => sections.ContainsKey(c.Type)))
            AppendUrl(sb, $"{origin}{SiteAddresses.Guides}");
        foreach (var (type, path) in sections)
            if (content.Any(c => c.Type == type))
                AppendUrl(sb, $"{origin}{path}");
        foreach (var c in content)
            AppendUrl(sb, $"{origin}{ContentRules.PublicPath(c.Type, c.Slug)}");

        sb.Append("</urlset>\n");
        return Content(sb.ToString(), "application/xml", Encoding.UTF8);
    }

    private static void AppendUrl(StringBuilder sb, string loc) =>
        sb.Append("  <url><loc>")
          .Append(System.Security.SecurityElement.Escape(loc))
          .Append("</loc></url>\n");
}
