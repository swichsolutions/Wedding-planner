using System.Security.Cryptography;
using WeddingPlanner.Domain.Entities;

namespace WeddingPlanner.Api.Planning;

/// <summary>The invitation's rules (B6): personal link codes, times, map links, the RSVP window.</summary>
public static class InviteRules
{
    /// <summary>"HH:mm", 00:00–23:59.</summary>
    public const string TimePattern = "^([01][0-9]|2[0-3]):[0-5][0-9]$";

    /// <summary>Typefaces for the names besides the design's own (all OFL, already on the site).</summary>
    public static readonly string[] FontKeys = { "classic", "plain", "capitals", "modern" };

    public static readonly string[] Answers = { "yes", "no" };

    public const int MaxSchedule = 12;
    public const int MaxPhotos = 6;

    // 31 symbols without look-alikes (0/o, 1/l/i): easy to read off a printed card.
    private const string Alphabet = "23456789abcdefghjkmnpqrstuvwxyz";
    private const int CodeLength = 12; // 31^12 ≈ 2^59: not guessable

    public static string NewCode()
    {
        Span<char> code = stackalloc char[CodeLength];
        for (var i = 0; i < CodeLength; i++) code[i] = Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)];
        return new string(code);
    }

    /// <summary>Only http(s) links reach a guest's browser: no javascript: or data: URLs.</summary>
    public static bool IsWebLink(string? url) =>
        Uri.TryCreate(url, UriKind.Absolute, out var u) && (u.Scheme == Uri.UriSchemeHttps || u.Scheme == Uri.UriSchemeHttp);

    /// <summary>Today in Georgia (UTC+4 all year), the day the deadline is counted in.</summary>
    public static DateOnly Today() => DateOnly.FromDateTime(DateTime.UtcNow.AddHours(4));

    /// <summary>Guests can still answer: RSVP is on and the deadline (inclusive) hasn't passed.</summary>
    public static bool IsOpen(WeddingSite s) => s.RsvpEnabled && (s.RsvpDeadline is null || s.RsvpDeadline >= Today());
}
