using Microsoft.Extensions.Logging;

namespace WeddingPlanner.Infrastructure.Email;

/// <summary>
/// Fallback when no SMTP server is configured: nothing is delivered. In development the whole
/// message is logged so a reset link can be copied from the console; elsewhere only the fact
/// that a mail was dropped — the body carries a live password-reset token and must not reach logs.
/// </summary>
public class LogEmailSender : IEmailSender
{
    private readonly ILogger<LogEmailSender> _logger;
    private readonly bool _includeContent;

    public LogEmailSender(ILogger<LogEmailSender> logger, bool includeContent)
    {
        _logger = logger;
        _includeContent = includeContent;
    }

    public Task SendAsync(EmailMessage message, CancellationToken ct = default)
    {
        if (_includeContent)
        {
            _logger.LogWarning(
                "Email not sent (no SMTP configured). To: {To} | Subject: {Subject}\n{Body}",
                message.To, message.Subject, message.TextBody);
        }
        else
        {
            _logger.LogError(
                "Email \"{Subject}\" was NOT delivered: Email:Smtp:Host is not configured.",
                message.Subject);
        }
        return Task.CompletedTask;
    }
}
