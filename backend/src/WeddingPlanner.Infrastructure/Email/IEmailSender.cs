namespace WeddingPlanner.Infrastructure.Email;

/// <summary>One outgoing email: a plain-text body always, an HTML body when the mail has one.</summary>
public record EmailMessage(string To, string Subject, string TextBody, string? HtmlBody = null);

/// <summary>
/// Abstraction over email delivery, so app code is identical whether mail goes out over SMTP
/// (production) or is only written to the log (dev fallback). Swap the implementation in DI.
/// </summary>
public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken ct = default);
}
