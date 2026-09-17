using WeddingPlanner.Api.Auth;
using WeddingPlanner.Api.Dtos;
using WeddingPlanner.Domain.Entities;
using WeddingPlanner.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace WeddingPlanner.Api.Controllers;

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

        // A non-empty WhatsApp value that doesn't normalize is a typo the vendor must
        // see — silently saving null returned 200 and the vendor believed it saved.
        var whatsapp = NormalizeWhatsapp(dto.Whatsapp);
        if (whatsapp is null && !string.IsNullOrWhiteSpace(dto.Whatsapp))
        {
            ModelState.AddModelError("whatsapp",
                "Invalid WhatsApp number. Use a phone number like +995 5XX XX XX XX.");
            return ValidationProblem(ModelState);
        }

        v.Name = dto.Name.Trim();
        var city = dto.City?.Trim();
        if (!string.IsNullOrEmpty(city) && city != v.City)
        {
            // Keep the URL/filter slug in sync with the label — otherwise the profile
            // says Batumi while its URL and the city filters still say Tbilisi.
            v.City = city;
            var citySlug = Slugs.From(city);
            v.CitySlug = citySlug.Length > 0 ? citySlug : $"city-{v.Id}";
        }
        v.Bio = dto.Bio?.Trim();
        v.PriceMin = dto.PriceMin;
        v.PriceRange = dto.PriceRange?.Trim();
        v.Instagram = dto.Instagram?.Trim();
        v.Facebook = dto.Facebook?.Trim();
        v.Phone = dto.Phone?.Trim();
        v.Whatsapp = whatsapp;
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

    /// <summary>
    /// Accepts a phone ("+995 599 12 34 56", "599 12 34 56") or a pasted wa.me /
    /// api.whatsapp.com link and stores bare digits. A 9-digit Georgian mobile
    /// (5XX XX XX XX) gets the 995 country code prefixed — wa.me needs it.
    /// </summary>
    private static string? NormalizeWhatsapp(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var digits = new string(raw.Where(char.IsDigit).ToArray());
        if (digits.Length == 9 && digits.StartsWith('5')) digits = "995" + digits;
        return digits.Length is >= 11 and <= 15 ? digits : null;
    }

    private static VendorDashboardDto ToDashboard(Vendor v) => new(
        v.Id, v.Name, v.Slug, v.Category.Slug, v.City, v.CitySlug,
        v.IsApproved, v.IsFeatured, v.Bio, v.PriceMin, v.PriceRange,
        v.Instagram, v.Facebook, v.Phone, v.Whatsapp, v.MapUrl, v.AreasServed,
        v.Photos.OrderBy(p => p.SortOrder)
            .Select(p => new VendorPhotoDto(p.Url, p.AltText, p.IsRealWedding)).ToArray());
}
