namespace WeddingPlanner.Api;

/// <summary>Contact-field normalization for the vendor dashboard.</summary>
public static class Contacts
{
    /// <summary>
    /// Accepts a phone ("+995 599 12 34 56", "599 12 34 56") or a pasted wa.me /
    /// api.whatsapp.com link and stores bare digits. A 9-digit Georgian mobile
    /// (5XX XX XX XX) gets the 995 country code prefixed — wa.me needs it.
    /// </summary>
    public static string? NormalizeWhatsapp(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var digits = new string(raw.Where(char.IsDigit).ToArray());
        if (digits.Length == 9 && digits.StartsWith('5')) digits = "995" + digits;
        return digits.Length is >= 11 and <= 15 ? digits : null;
    }
}
