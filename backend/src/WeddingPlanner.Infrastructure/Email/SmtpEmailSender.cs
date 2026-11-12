using System.Net;
using System.Net.Mail;
using System.Text;

namespace WeddingPlanner.Infrastructure.Email;

/// <summary>Connection settings for <see cref="SmtpEmailSender"/> (config section Email:Smtp + Email:From).</summary>
public record SmtpSettings(
    string Host,
    int Port,
    string? Username,
    string? Password,
    bool EnableSsl,
    string FromAddress,
    string? FromName);

/// <summary>
/// Sends through any SMTP provider (Brevo, Mailgun, SendGrid, Resend, Gmail…). Uses STARTTLS,
/// so give it the provider's submission port (587) — System.Net.Mail can't do implicit TLS on 465.
/// </summary>
public class SmtpEmailSender : IEmailSender
{
    private readonly SmtpSettings _settings;

    public SmtpEmailSender(SmtpSettings settings) => _settings = settings;

    public async Task SendAsync(EmailMessage message, CancellationToken ct = default)
    {
        using var mail = new MailMessage
        {
            From = new MailAddress(_settings.FromAddress, _settings.FromName, Encoding.UTF8),
            Subject = message.Subject,
            SubjectEncoding = Encoding.UTF8,
            Body = message.TextBody,
            BodyEncoding = Encoding.UTF8,
            IsBodyHtml = false,
        };
        mail.To.Add(message.To);
        if (!string.IsNullOrWhiteSpace(message.ReplyTo))
            mail.ReplyToList.Add(new MailAddress(message.ReplyTo));
        if (message.HtmlBody is not null)
        {
            // Text first, HTML last: clients show the last alternative they can render.
            mail.AlternateViews.Add(AlternateView.CreateAlternateViewFromString(
                message.HtmlBody, Encoding.UTF8, "text/html"));
        }

        // SmtpClient isn't safe for concurrent sends — one per message.
        using var client = new SmtpClient(_settings.Host, _settings.Port)
        {
            EnableSsl = _settings.EnableSsl,
            DeliveryMethod = SmtpDeliveryMethod.Network,
        };
        if (!string.IsNullOrEmpty(_settings.Username))
            client.Credentials = new NetworkCredential(_settings.Username, _settings.Password);

        await client.SendMailAsync(mail, ct);
    }
}
