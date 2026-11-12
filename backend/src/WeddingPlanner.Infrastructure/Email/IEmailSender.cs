namespace WeddingPlanner.Infrastructure.Email;

/// <summary>
/// One outgoing email: a plain-text body always, an HTML body when the mail has one.
/// <paramref name="ReplyTo"/> is where "Reply" goes when that isn't the sender (the contact
/// form's mail comes from our own address but should be answered to the visitor).
/// </summary>
public record EmailMessage(
    string To, string Subject, string TextBody, string? HtmlBody = null, string? ReplyTo = null);

/// <summary>
/// Abstraction over email delivery, so app code is identical whether mail goes out over SMTP
/// (production) or is only written to the log (dev fallback). Swap the implementation in DI.
/// </summary>
public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken ct = default);
}
