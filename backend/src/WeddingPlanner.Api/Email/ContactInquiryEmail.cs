using WeddingPlanner.Infrastructure.Email;

namespace WeddingPlanner.Api.Email;

/// <summary>
/// The mail the site inbox gets when a visitor sends the form on /contact. Plain text, in
/// Georgian (it is read by us, not by the visitor). Reply-To is the visitor, so answering the
/// mail answers them.
/// </summary>
public static class ContactInquiryEmail
{
    /// <summary>Where inquiries go unless Email:ContactTo says otherwise: the address shown on /contact.</summary>
    public const string DefaultRecipient = "info@weddingplanner.ge";

    public static EmailMessage Build(
        string to, string name, string email, string? phone, string message, string brand, string origin)
    {
        // A fixed subject: nothing the visitor typed goes into a mail header.
        var subject = $"{brand}: ახალი შეტყობინება საკონტაქტო ფორმიდან";

        var text =
            "საკონტაქტო ფორმიდან ახალი შეტყობინება მოვიდა.\n\n" +
            $"სახელი: {OneLine(name)}\n" +
            $"ელ. ფოსტა: {OneLine(email)}\n" +
            $"ტელეფონი: {(string.IsNullOrWhiteSpace(phone) ? "—" : OneLine(phone))}\n\n" +
            $"{message.Trim()}\n\n" +
            "—\n" +
            "პასუხის გასაცემად უპასუხე ამ წერილს: პასუხი გამომგზავნის ელ. ფოსტაზე წავა.\n" +
            $"{origin}/contact\n";

        return new EmailMessage(to, subject, text, ReplyTo: email.Trim());
    }

    /// <summary>A single-line field stays on its line: line breaks and other control characters become spaces.</summary>
    private static string OneLine(string value) =>
        new string(value.Trim().Select(c => char.IsControl(c) ? ' ' : c).ToArray());
}
