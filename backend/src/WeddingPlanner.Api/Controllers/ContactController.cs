using System.Net.Mail;
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
    /// Inquiries mailed per hour, site-wide. The per-IP limit ("contact": 3 in 10 minutes, so
    /// 18 an hour at most from one address, which cannot fill this on its own) doesn't stop a
    /// flood from many addresses, and each inquiry is a mail out of the same SMTP allowance
    /// as password resets.
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
    [EnableRateLimiting("contact")]
    public async Task<IActionResult> Send([FromBody] ContactInquiryDto dto, CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        // A filled honeypot is a bot: answer as if sent, mail nothing. Logged without any of
        // its content, so that a real visitor caught by it (an autofill tool filling every
        // field) can at least be noticed.
        if (!string.IsNullOrWhiteSpace(dto.Website))
        {
            _logger.LogInformation("A contact inquiry was dropped: the honeypot field was filled.");
            return Accepted();
        }

        // [EmailAddress] only looks for one '@'. The address becomes the mail's Reply-To, and
        // System.Net.Mail is stricter ("a@b c" throws there): say so as a bad request here,
        // not as "could not send" after the fact.
        if (!MailAddress.TryCreate(dto.Email.Trim(), out _))
        {
            ModelState.AddModelError(nameof(dto.Email), "The email address is not valid.");
            return ValidationProblem(ModelState);
        }

        // Without SMTP nothing is delivered (the fallback sender only logs). Development keeps
        // working that way: the mail is printed to the console.
        if (!_delivery.Enabled && !_env.IsDevelopment())
        {
            _logger.LogError("A contact inquiry could not be mailed: Email:Smtp:Host is not configured.");
            return StatusCode(StatusCodes.Status503ServiceUnavailable);
        }

        if (SentThisHour().Value >= HourlyCap)
        {
            _logger.LogWarning("Contact inquiries reached {Cap} this hour; further ones are refused.", HourlyCap);
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

        // Only mail that went out counts against the hour: failed sends cost neither inbox
        // space nor SMTP allowance, and must not lock the form once the mail server is back.
        Interlocked.Increment(ref SentThisHour().Value);
        return Accepted();
    }

    /// <summary>
    /// The count of inquiries mailed in the current clock hour (a new counter each hour).
    /// Requests in flight together may pass the cap by a few; it is a brake, not a quota.
    /// </summary>
    private Counter SentThisHour() =>
        _cache.GetOrCreate($"contact:{DateTimeOffset.UtcNow:yyyyMMddHH}", entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(1);
            return new Counter();
        })!;

    private sealed class Counter
    {
        public int Value;
    }
}
