using WeddingPlanner.Api.Dtos;
using WeddingPlanner.Domain.Entities;
using WeddingPlanner.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace WeddingPlanner.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MessagesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<MessagesController> _logger;

    public MessagesController(AppDbContext db, ILogger<MessagesController> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>Couple → vendor message from the public contact form (no account required).</summary>
    [HttpPost]
    [EnableRateLimiting("messages")]
    public async Task<IActionResult> Create([FromBody] CreateMessageDto dto)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        // Require at least one way to reply.
        if (string.IsNullOrWhiteSpace(dto.SenderEmail) && string.IsNullOrWhiteSpace(dto.SenderPhone))
            return BadRequest("Provide an email or phone so the vendor can reply.");

        var vendor = await _db.Vendors
            .Where(v => v.Id == dto.VendorId && v.IsApproved)
            .Select(v => new { HasOwner = _db.Users.Any(u => u.VendorId == v.Id) })
            .FirstOrDefaultAsync();
        if (vendor is null)
            return NotFound();
        // An admin-added profile has no account to read the inbox yet: a message would go unread.
        if (!vendor.HasOwner)
            return Conflict("This vendor doesn't take messages here yet. Use their phone or links.");

        _db.Messages.Add(new Message
        {
            VendorId = dto.VendorId,
            SenderName = dto.SenderName?.Trim(),
            SenderEmail = dto.SenderEmail?.Trim(),
            SenderPhone = dto.SenderPhone?.Trim(),
            Body = dto.Body.Trim(),
            CreatedAt = DateTimeOffset.UtcNow,
        });

        await _db.SaveChangesAsync();

        // Silent engagement tracking (CLAUDE.md §5). Atomic upsert (no first-two-of-the-day
        // race), and best-effort AFTER the save — a stats hiccup must never lose the message.
        try
        {
            await VendorStatTracking.IncrementAsync(_db, dto.VendorId, messages: 1);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "VendorStat message increment failed for vendor {VendorId}", dto.VendorId);
        }

        return StatusCode(StatusCodes.Status201Created);
    }
}
