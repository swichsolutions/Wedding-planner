using Ipsum.Api.Dtos;
using Ipsum.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ipsum.Api.Controllers;

/// <summary>Public read side of couples' wedding websites (/w/{slug} pages).</summary>
[ApiController]
[Route("api/sites")]
public class PublicSitesController : ControllerBase
{
    private readonly AppDbContext _db;

    public PublicSitesController(AppDbContext db) => _db = db;

    /// <summary>
    /// Guest-facing site finder (Zola-style). First name, last name AND year are all
    /// required so published sites can't be browsed wholesale — a guest has to know
    /// who they're looking for. The name matches either partner, case-insensitively,
    /// as a substring; results are ordered by closeness to the requested month.
    /// </summary>
    [HttpGet("search")]
    public async Task<ActionResult<IEnumerable<SiteSearchResultDto>>> Search(
        [FromQuery] string? firstName,
        [FromQuery] string? lastName,
        [FromQuery] int year,
        [FromQuery] int? month)
    {
        var first = firstName?.Trim();
        var last = lastName?.Trim();
        if (string.IsNullOrEmpty(first) || string.IsNullOrEmpty(last) || year is < 2000 or > 2100)
            return BadRequest();

        var fp = $"%{first}%";
        var lp = $"%{last}%";
        var target = month is >= 1 and <= 12 ? month.Value : 0;

        var results = await _db.WeddingSites
            .AsNoTracking()
            .Where(s => s.IsPublished && s.Slug != null && s.WeddingDate != null)
            .Where(s => s.WeddingDate!.Value.Year == year)
            .Where(s =>
                (EF.Functions.ILike(s.FirstName!, fp) && EF.Functions.ILike(s.LastName!, lp)) ||
                (EF.Functions.ILike(s.PartnerFirstName!, fp) && EF.Functions.ILike(s.PartnerLastName!, lp)))
            .OrderBy(s => target == 0 ? 0 : Math.Abs(s.WeddingDate!.Value.Month - target))
            .ThenBy(s => s.WeddingDate)
            .Take(20)
            .Select(s => new SiteSearchResultDto(
                s.FirstName, s.LastName, s.PartnerFirstName, s.PartnerLastName,
                s.WeddingDate!.Value, s.Place, s.Slug!))
            .ToListAsync();

        return Ok(results);
    }

    [HttpGet("{slug}")]
    public async Task<ActionResult<PublicSiteDto>> Get(string slug)
    {
        var site = await _db.WeddingSites
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Slug == slug && s.IsPublished);
        if (site is null) return NotFound();

        return Ok(new PublicSiteDto(
            site.TemplateKey,
            site.FirstName,
            site.PartnerFirstName,
            site.WeddingDate,
            site.Place,
            site.Message,
            site.InkColor,
            site.AccentColor,
            site.PhotoUrl));
    }
}
