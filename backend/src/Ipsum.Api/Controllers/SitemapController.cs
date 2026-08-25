using System.Text;
using Ipsum.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ipsum.Api.Controllers;

/// <summary>
/// sitemap.xml generated from REAL data: the home page, the browse page, one URL per
/// category×city pairing that actually has approved vendors, and one per approved
/// vendor profile. Served at the site root, so production must proxy /sitemap.xml to
/// the API alongside /api and /uploads (CLAUDE.md §10). Guides/budget/website URLs
/// are deliberately absent — guide content is still frontend mock data and joins the
/// sitemap when it moves to the ContentPage table. No lastmod: vendors don't carry an
/// UpdatedAt, and a fabricated timestamp is worse than none.
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

        // One pass: the vendor slugs are the page list, and the distinct
        // (category, city) prefixes of the same rows are the landing pages.
        var vendors = await _db.Vendors
            .AsNoTracking()
            .Where(v => v.IsApproved && v.CitySlug != "")
            .Select(v => new { CategorySlug = v.Category.Slug, v.CitySlug, v.Slug })
            .OrderBy(v => v.CategorySlug).ThenBy(v => v.CitySlug).ThenBy(v => v.Slug)
            .ToListAsync();

        var sb = new StringBuilder();
        sb.Append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        sb.Append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");

        AppendUrl(sb, $"{origin}/");
        AppendUrl(sb, $"{origin}/vendors");
        foreach (var p in vendors.Select(v => (v.CategorySlug, v.CitySlug)).Distinct())
            AppendUrl(sb, $"{origin}/{p.CategorySlug}/{p.CitySlug}");
        foreach (var v in vendors)
            AppendUrl(sb, $"{origin}/{v.CategorySlug}/{v.CitySlug}/{v.Slug}");

        sb.Append("</urlset>\n");
        return Content(sb.ToString(), "application/xml", Encoding.UTF8);
    }

    private static void AppendUrl(StringBuilder sb, string loc) =>
        sb.Append("  <url><loc>")
          .Append(System.Security.SecurityElement.Escape(loc))
          .Append("</loc></url>\n");
}
