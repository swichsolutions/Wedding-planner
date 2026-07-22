using Ipsum.Api.Auth;
using Ipsum.Api.Dtos;
using Ipsum.Domain.Entities;
using Ipsum.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ipsum.Api.Controllers;

[ApiController]
[Route("api/vendor")]
[Authorize(Roles = Roles.Vendor)]
public class VendorDashboardController : ControllerBase
{
    private readonly AppDbContext _db;

    public VendorDashboardController(AppDbContext db) => _db = db;

    private int? VendorId =>
        int.TryParse(User.FindFirst("vendorId")?.Value, out var id) ? id : null;

    [HttpGet("me")]
    public async Task<ActionResult<VendorDashboardDto>> GetMe()
    {
        if (VendorId is not int id) return Forbid();

        var v = await _db.Vendors
            .Include(x => x.Category)
            .Include(x => x.Photos)
            .FirstOrDefaultAsync(x => x.Id == id);

        return v is null ? NotFound() : Ok(ToDashboard(v));
    }

    [HttpPut("me")]
    public async Task<ActionResult<VendorDashboardDto>> UpdateMe([FromBody] VendorEditDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (VendorId is not int id) return Forbid();

        var v = await _db.Vendors.Include(x => x.Category).Include(x => x.Photos)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (v is null) return NotFound();

        v.Name = dto.Name.Trim();
        v.City = dto.City?.Trim() ?? v.City;
        v.Bio = dto.Bio?.Trim();
        v.PriceMin = dto.PriceMin;
        v.PriceRange = dto.PriceRange?.Trim();
        v.Instagram = dto.Instagram?.Trim();
        v.Facebook = dto.Facebook?.Trim();
        v.Phone = dto.Phone?.Trim();
        v.MapUrl = dto.MapUrl?.Trim();
        v.AreasServed = dto.AreasServed?.Trim();
        await _db.SaveChangesAsync();

        return Ok(ToDashboard(v));
    }

    [HttpGet("me/messages")]
    public async Task<ActionResult<IEnumerable<InboxMessageDto>>> GetMessages()
    {
        if (VendorId is not int id) return Forbid();

        var messages = await _db.Messages
            .AsNoTracking()
            .Where(m => m.VendorId == id)
            .OrderByDescending(m => m.CreatedAt)
            .Select(m => new InboxMessageDto(
                m.Id, m.SenderName, m.SenderEmail, m.SenderPhone, m.Body, m.IsRead, m.CreatedAt))
            .ToListAsync();

        return Ok(messages);
    }

    [HttpPost("me/messages/{messageId:int}/read")]
    public async Task<IActionResult> MarkRead(int messageId)
    {
        if (VendorId is not int id) return Forbid();

        var msg = await _db.Messages.FirstOrDefaultAsync(m => m.Id == messageId && m.VendorId == id);
        if (msg is null) return NotFound();

        msg.IsRead = true;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("me/stats")]
    public async Task<ActionResult<VendorStatsDto>> GetStats()
    {
        if (VendorId is not int id) return Forbid();

        var stats = await _db.VendorStats.AsNoTracking().Where(s => s.VendorId == id).ToListAsync();
        var unread = await _db.Messages.CountAsync(m => m.VendorId == id && !m.IsRead);

        return Ok(new VendorStatsDto(
            stats.Sum(s => s.ProfileViews),
            stats.Sum(s => s.ContactClicks),
            stats.Sum(s => s.Messages),
            unread));
    }

    private static VendorDashboardDto ToDashboard(Vendor v) => new(
        v.Id, v.Name, v.Slug, v.Category.Slug, v.City, v.CitySlug,
        v.IsApproved, v.IsFeatured, v.Bio, v.PriceMin, v.PriceRange,
        v.Instagram, v.Facebook, v.Phone, v.MapUrl, v.AreasServed,
        v.Photos.OrderBy(p => p.SortOrder)
            .Select(p => new VendorPhotoDto(p.Url, p.AltText, p.IsRealWedding)).ToArray());
}
