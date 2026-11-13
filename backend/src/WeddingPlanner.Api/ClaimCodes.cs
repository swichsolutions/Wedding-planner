using System.Security.Cryptography;
using System.Text;

namespace WeddingPlanner.Api;

/// <summary>
/// One-time codes for vendors to take over a profile an admin made (2026-11-13). The admin
/// creates a code in the admin panel and sends it, with its link, to the vendor's own Instagram,
/// WhatsApp or phone; the vendor opens the link, enters an email and a password, and owns the
/// profile at once. Only a hash is stored. 8 characters from 31 easily told apart (no 0/O, 1/I/L)
/// give about 850 billion combinations, and lookups are rate-limited, so guessing is hopeless.
/// </summary>
public static class ClaimCodes
{
    private const string Alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 31 letters and digits
    public static readonly TimeSpan Lifetime = TimeSpan.FromDays(14);

    /// <summary>A new code as the vendor sees it: "K7QM-4P2X".</summary>
    public static string Generate()
    {
        Span<char> chars = stackalloc char[8];
        for (var i = 0; i < chars.Length; i++)
            chars[i] = Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)];
        return $"{new string(chars[..4])}-{new string(chars[4..])}";
    }

    /// <summary>What a typed or linked code counts as: letters and digits only, upper case. "k7qm 4p2x" = "K7QM-4P2X".</summary>
    public static string Normalize(string? code) =>
        new string((code ?? "").Where(char.IsAsciiLetterOrDigit).Select(char.ToUpperInvariant).ToArray());

    /// <summary>The stored form: SHA-256 of the normalized code, lower-case hex. Null for an empty or malformed code.</summary>
    public static string? Hash(string? code)
    {
        var normalized = Normalize(code);
        if (normalized.Length != 8) return null;
        return Convert.ToHexString(SHA256.HashData(Encoding.ASCII.GetBytes(normalized))).ToLowerInvariant();
    }
}
