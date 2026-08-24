using System.Text;
using System.Text.RegularExpressions;

namespace Ipsum.Api;

/// <summary>
/// URL slug generation shared by vendor registration, vendor profile edits, and
/// wedding-site publishing. Georgian Mkhedruli transliterates to Latin so Georgian
/// input gets a real slug ("ბათუმი" → "batumi") instead of an id fallback —
/// category×city SEO pages depend on stable, meaningful city slugs.
/// </summary>
public static class Slugs
{
    /// <summary>
    /// Lowercase Latin slug: Georgian transliterated, Latin/digits pass through,
    /// everything else becomes a dash. Empty when nothing survives.
    /// </summary>
    public static string From(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) return string.Empty;

        var sb = new StringBuilder(input.Length * 2);
        foreach (var ch in input.ToLowerInvariant())
        {
            if (GeorgianToLatin.TryGetValue(ch, out var latin)) sb.Append(latin);
            else if (ch is >= 'a' and <= 'z' or >= '0' and <= '9') sb.Append(ch);
            else sb.Append('-');
        }
        var slug = Regex.Replace(sb.ToString(), "-{2,}", "-").Trim('-');
        // Transliteration can double the input length (შ→sh, ძ→dz, …), and callers
        // append "-{id}"/"-{n}" suffixes on top; the tightest consumer column is
        // WeddingSite.Slug varchar(160). Cap well below so no path can overflow.
        return slug.Length <= 80 ? slug : slug[..80].Trim('-');
    }

    private static readonly Dictionary<char, string> GeorgianToLatin = new()
    {
        ['ა'] = "a", ['ბ'] = "b", ['გ'] = "g", ['დ'] = "d", ['ე'] = "e", ['ვ'] = "v",
        ['ზ'] = "z", ['თ'] = "t", ['ი'] = "i", ['კ'] = "k", ['ლ'] = "l", ['მ'] = "m",
        ['ნ'] = "n", ['ო'] = "o", ['პ'] = "p", ['ჟ'] = "zh", ['რ'] = "r", ['ს'] = "s",
        ['ტ'] = "t", ['უ'] = "u", ['ფ'] = "p", ['ქ'] = "q", ['ღ'] = "gh", ['ყ'] = "q",
        ['შ'] = "sh", ['ჩ'] = "ch", ['ც'] = "ts", ['ძ'] = "dz", ['წ'] = "ts", ['ჭ'] = "ch",
        ['ხ'] = "kh", ['ჯ'] = "j", ['ჰ'] = "h",
    };
}
