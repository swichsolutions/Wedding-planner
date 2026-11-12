using System.Net;
using WeddingPlanner.Infrastructure.Email;

namespace WeddingPlanner.Api.Email;

/// <summary>The partner invitation (BUILD-PLAN B1): join a shared wedding plan. Georgian by default.</summary>
public static class PartnerInviteEmail
{
    /// <summary>How long an invitation link works.</summary>
    public static readonly TimeSpan LinkLifetime = TimeSpan.FromDays(14);

    private record Copy(
        string Subject, string Greeting, string Intro, string IntroNamed,
        string Button, string Validity, string Ignore, string Fallback);

    private static readonly Copy Ka = new(
        Subject: "{0}: მოგიწვიეს ქორწილის საერთო გეგმაზე",
        Greeting: "გამარჯობა!",
        Intro: "მოგიწვიეს ქორწილის საერთო გეგმაზე: დავალებები, ბიუჯეტი, სტუმრები და დანარჩენი ერთად გექნებათ.",
        IntroNamed: "{1} გიწვევს ქორწილის საერთო გეგმაზე: დავალებები, ბიუჯეტი, სტუმრები და დანარჩენი ერთად გექნებათ.",
        Button: "შეუერთდი გეგმას",
        Validity: "ბმული 14 დღე მოქმედებს და მხოლოდ ერთხელ გამოიყენება. ანგარიში თუ არ გაქვს, შექმნა იქვე შეგიძლია.",
        Ignore: "თუ ეს წერილი შეცდომით მიიღე, უბრალოდ უგულებელყავი.",
        Fallback: "ღილაკი არ მუშაობს? დააკოპირე ეს ბმული ბრაუზერში:");

    private static readonly Copy En = new(
        Subject: "{0}: you're invited to a shared wedding plan",
        Greeting: "Hi,",
        Intro: "You've been invited to a shared wedding plan: tasks, budget, guests and the rest, together.",
        IntroNamed: "{1} invited you to a shared wedding plan: tasks, budget, guests and the rest, together.",
        Button: "Join the plan",
        Validity: "The link works for 14 days and can be used once. No account yet? You can create one there.",
        Ignore: "If you got this by mistake, you can ignore it.",
        Fallback: "Button not working? Copy this link into your browser:");

    public static EmailMessage Build(string to, string link, string? inviter, string? lang, string brand)
    {
        var en = string.Equals(lang, "en", StringComparison.OrdinalIgnoreCase);
        var c = en ? En : Ka;
        var named = !string.IsNullOrWhiteSpace(inviter);
        // The subject is fixed: the inviter's name is free text the couple typed, and the mail
        // goes to an address they typed too, so a name in the subject line would let anyone
        // send a stranger a subject of their choosing under our name. The name stays in the body.
        var subject = string.Format(c.Subject, brand);
        var intro = string.Format(named ? c.IntroNamed : c.Intro, brand, inviter);

        var text = $"{c.Greeting}\n\n{intro}\n\n{link}\n\n{c.Validity}\n\n{c.Ignore}\n\n{brand}\n";

        // Same look as the password-reset mail: ivory page, white panel, evergreen button.
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
                    <p style="margin:0 0 24px;font-size:16px;line-height:1.5;">{h(intro)}</p>
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
