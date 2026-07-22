using Ipsum.Api.Dtos;
using Ipsum.Domain.Entities;
using Ipsum.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ipsum.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MessagesController : ControllerBase
{
    private readonly AppDbContext _db;

    public MessagesController(AppDbContext db) => _db = db;

    /// <summary>Couple → vendor message from the public contact form (no account required).</summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateMessageDto dto)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        // Require at least one way to reply.
        if (string.IsNullOrWhiteSpace(dto.SenderEmail) && string.IsNullOrWhiteSpace(dto.SenderPhone))
            return BadRequest("Provide an email or phone so the vendor can reply.");

        var vendorExists = await _db.Vendors.AnyAsync(v => v.Id == dto.VendorId && v.IsApproved);
        if (!vendorExists)
            return NotFound();

        _db.Messages.Add(new Message
        {
            VendorId = dto.VendorId,
            SenderName = dto.SenderName?.Trim(),
            SenderEmail = dto.SenderEmail?.Trim(),
            SenderPhone = dto.SenderPhone?.Trim(),
            Body = dto.Body.Trim(),
            CreatedAt = DateTimeOffset.UtcNow,
        });

        // Silent engagement tracking — future sales tool for featured placement (CLAUDE.md §5).
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var stat = await _db.VendorStats.FirstOrDefaultAsync(s => s.VendorId == dto.VendorId && s.Date == today);
        if (stat is null)
        {
            stat = new VendorStat { VendorId = dto.VendorId, Date = today };
            _db.VendorStats.Add(stat);
        }
        stat.Messages++;

        await _db.SaveChangesAsync();
        return StatusCode(StatusCodes.Status201Created);
    }
}
