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
