using WeddingPlanner.Api.Dtos;
using WeddingPlanner.Api.Email;
using WeddingPlanner.Infrastructure.Email;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Caching.Memory;

namespace WeddingPlanner.Api.Controllers;

/// <summary>
/// The inquiry form on /contact (review of 2026-11-12). The message is mailed to the site inbox
/// and stored nowhere, so the send is awaited here instead of going through the outbox: if the
/// mail can't go out, the visitor must be told, not shown "sent".
/// </summary>
[ApiController]
[Route("api/contact")]
public class ContactController : ControllerBase
{
    /// <summary>
    /// Inquiries mailed per hour, site-wide. The per-IP limit doesn't stop a flood from many
    /// addresses, and each inquiry is a mail out of the same SMTP allowance as password resets.
    /// </summary>
    private const int HourlyCap = 40;

    /// <summary>How long one SMTP send may take before the visitor is told it failed.</summary>
    private static readonly TimeSpan SendTimeout = TimeSpan.FromSeconds(20);

    private readonly IEmailSender _sender;
    private readonly EmailDelivery _delivery;
    private readonly IMemoryCache _cache;
    private readonly IConfiguration _config;
    private readonly IHostEnvironment _env;
    private readonly ILogger<ContactController> _logger;

    public ContactController(
        IEmailSender sender,
        EmailDelivery delivery,
        IMemoryCache cache,
        IConfiguration config,
        IHostEnvironment env,
        ILogger<ContactController> logger)
    {
        _sender = sender;
        _delivery = delivery;
        _cache = cache;
        _config = config;
        _env = env;
        _logger = logger;
    }

    /// <summary>202 when the mail went out; 503 when it could not, so the form can point to the address instead.</summary>
    [HttpPost]
    [EnableRateLimiting("messages")]
    public async Task<IActionResult> Send([FromBody] ContactInquiryDto dto, CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        // A filled honeypot is a bot: answer as if sent, mail nothing.
        if (!string.IsNullOrWhiteSpace(dto.Website))
            return Accepted();

        // Without SMTP nothing is delivered (the fallback sender only logs). Development keeps
        // working that way: the mail is printed to the console.
        if (!_delivery.Enabled && !_env.IsDevelopment())
        {
            _logger.LogError("A contact inquiry could not be mailed: Email:Smtp:Host is not configured.");
            return StatusCode(StatusCodes.Status503ServiceUnavailable);
        }

        if (!UnderHourlyCap())
        {
            _logger.LogWarning("Contact inquiries passed {Cap} this hour; further ones are refused.", HourlyCap);
            return StatusCode(StatusCodes.Status503ServiceUnavailable);
        }

        var to = _config["Email:ContactTo"] is { Length: > 0 } configured && !string.IsNullOrWhiteSpace(configured)
            ? configured.Trim()
            : ContactInquiryEmail.DefaultRecipient;
        var mail = ContactInquiryEmail.Build(
            to, dto.Name, dto.Email, dto.Phone, dto.Message,
            SiteLinks.Brand(_config), SiteLinks.FrontendOrigin(_config));

        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(SendTimeout);
        try
        {
            await _sender.SendAsync(mail, timeout.Token);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw; // the visitor went away
        }
        catch (Exception ex)
        {
            // The message itself is personal: log that it failed, not what it said.
            _logger.LogError(ex, "Sending a contact inquiry failed.");
            return StatusCode(StatusCodes.Status503ServiceUnavailable);
        }

        return Accepted();
    }

    /// <summary>Counts this inquiry against the current clock hour; false once the hour is full.</summary>
    private bool UnderHourlyCap()
    {
        var counter = _cache.GetOrCreate($"contact:{DateTimeOffset.UtcNow:yyyyMMddHH}", entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(1);
            return new Counter();
        })!;
        return Interlocked.Increment(ref counter.Value) <= HourlyCap;
    }

    private sealed class Counter
    {
        public int Value;
    }
}
