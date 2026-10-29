using System.Net;
using WeddingPlanner.Infrastructure.Email;

namespace WeddingPlanner.Api.Email;

/// <summary>The password-reset email, in Georgian (default) or English.</summary>
public static class PasswordResetEmail
{
    /// <summary>How long a reset link works. Also set as Identity's token lifespan in Program.cs.</summary>
    public static readonly TimeSpan LinkLifetime = TimeSpan.FromHours(1);

    private record Copy(
        string Subject, string Greeting, string Intro, string Button,
        string Validity, string Ignore, string Fallback);

    private static readonly Copy Ka = new(
        Subject: "{0}: პაროლის აღდგენა",
        Greeting: "გამარჯობა!",
        Intro: "მივიღეთ მოთხოვნა შენი ანგარიშის პაროლის აღსადგენად. ახალი პაროლის დასაყენებლად გახსენი ეს ბმული:",
        Button: "ახალი პაროლის დაყენება",
        Validity: "ბმული 1 საათი მოქმედებს და მხოლოდ ერთხელ გამოიყენება.",
        Ignore: "თუ ეს შენ არ მოგითხოვია, უბრალოდ უგულებელყავი წერილი. შენი პაროლი არ შეიცვლება.",
        Fallback: "ღილაკი არ მუშაობს? დააკოპირე ეს ბმული ბრაუზერში:");

    private static readonly Copy En = new(
        Subject: "{0}: reset your password",
        Greeting: "Hi,",
        Intro: "We received a request to reset the password for your account. Open this link to set a new password:",
        Button: "Set a new password",
        Validity: "The link works for 1 hour and can be used once.",
        Ignore: "If you didn't ask for this, you can ignore this email. Your password won't change.",
        Fallback: "Button not working? Copy this link into your browser:");

    public static EmailMessage Build(string to, string link, string? lang, string brand)
    {
        var en = string.Equals(lang, "en", StringComparison.OrdinalIgnoreCase);
        var c = en ? En : Ka;
        var subject = string.Format(c.Subject, brand);

        var text =
            $"{c.Greeting}\n\n{c.Intro}\n\n{link}\n\n{c.Validity}\n\n{c.Ignore}\n\n{brand}\n";

        // Brand colours (CLAUDE.md): ivory page, white panel, charcoal text, evergreen button.
        // System fonts — mail clients won't load GF Aisi.
        static string h(string s) => WebUtility.HtmlEncode(s);
        var html = $"""
            <!doctype html>
            <html lang="{(en ? "en" : "ka")}">
            <body style="margin:0;padding:24px 12px;background:#FAF7F2;color:#302B2D;font-family:Arial,'Noto Sans Georgian',sans-serif;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;">
                  <tr><td style="padding:32px 28px;">
                    <p style="margin:0 0 24px;font-size:18px;font-weight:bold;">{h(brand)}</p>
                    <p style="margin:0 0 12px;font-size:16px;line-height:1.5;">{h(c.Greeting)}</p>
                    <p style="margin:0 0 24px;font-size:16px;line-height:1.5;">{h(c.Intro)}</p>
                    <p style="margin:0 0 24px;">
                      <a href="{h(link)}" style="display:inline-block;padding:14px 24px;background:#29483F;color:#ffffff;text-decoration:none;border-radius:999px;font-size:16px;line-height:1.4;">{h(c.Button)}</a>
                    </p>
                    <p style="margin:0 0 12px;font-size:14px;line-height:1.5;color:#585454;">{h(c.Validity)}</p>
                    <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#585454;">{h(c.Ignore)}</p>
                    <p style="margin:0;font-size:13px;line-height:1.5;color:#6d6868;word-break:break-all;">{h(c.Fallback)}<br><a href="{h(link)}" style="color:#302B2D;">{h(link)}</a></p>
                  </td></tr>
                </table>
              </td></tr></table>
            </body>
            </html>
            """;

        return new EmailMessage(to, subject, text, html);
    }
}
