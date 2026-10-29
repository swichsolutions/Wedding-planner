using WeddingPlanner.Domain.Entities;

namespace WeddingPlanner.Api;

/// <summary>
/// Content types as they appear in URLs and JSON, the allowed topics per type (guide §5),
/// and where each published page lives on the site (design-system/PROPOSALS.md P11).
/// </summary>
public static class ContentRules
{
    private static readonly Dictionary<string, ContentPageType> TypesByKey = new()
    {
        ["article"] = ContentPageType.Article,
        ["inspiration"] = ContentPageType.Inspiration,
        ["real-wedding"] = ContentPageType.RealWedding,
        ["legal"] = ContentPageType.Legal,
    };

    /// <summary>Blog topics: starting, budget, choosing vendors, guests, day schedule, invitation.</summary>
    public static readonly string[] ArticleTopics = { "start", "budget", "vendors", "guests", "day", "invitation" };

    /// <summary>Inspiration themes: colours, decor, flowers, table setting, lighting, cakes, invitation designs.</summary>
    public static readonly string[] InspirationTopics = { "colors", "decor", "flowers", "tables", "lighting", "cakes", "invitations" };

    /// <summary>Legal pages sit at the top level (/terms), so only these slugs are allowed.</summary>
    public static readonly string[] LegalSlugs = { "terms", "privacy" };

    public static bool TryParseType(string? key, out ContentPageType type) =>
        TypesByKey.TryGetValue(key?.Trim().ToLowerInvariant() ?? string.Empty, out type);

    public static string Key(ContentPageType type) => TypesByKey.First(p => p.Value == type).Key;

    public static bool IsValidTopic(ContentPageType type, string? topic) => type switch
    {
        ContentPageType.Article => topic is null || ArticleTopics.Contains(topic),
        ContentPageType.Inspiration => topic is null || InspirationTopics.Contains(topic),
        _ => topic is null,
    };

    public static string PublicPath(ContentPageType type, string slug) => type switch
    {
        ContentPageType.Article => $"/guides/blog/{slug}",
        ContentPageType.Inspiration => $"/guides/inspiration/{slug}",
        ContentPageType.RealWedding => $"/guides/real-weddings/{slug}",
        _ => $"/{slug}",
    };

    /// <summary>An in-site link only: "/vendors?category=x" yes; "//evil.com", "https://…" or whitespace no.</summary>
    public static bool IsValidActionPath(string path) =>
        path.StartsWith('/') && !path.StartsWith("//") && !path.Contains('\\') && !path.Any(char.IsWhiteSpace);
}
