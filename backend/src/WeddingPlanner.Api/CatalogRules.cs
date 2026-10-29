namespace WeddingPlanner.Api;

/// <summary>
/// Allowed values for the catalog's vendor attributes (design-system/PROPOSALS.md P2–P5,
/// approved 2026-10-21). Mirrored in the frontend's core/catalog.ts.
/// </summary>
public static class CatalogRules
{
    /// <summary>Tbilisi + regions (P4).</summary>
    public static readonly string[] Regions =
    {
        "tbilisi", "kakheti", "mtskheta-mtianeti", "imereti", "adjara", "kvemo-kartli", "shida-kartli",
        "samtskhe-javakheti", "samegrelo-zemo-svaneti", "guria", "racha-lechkhumi",
    };

    /// <summary>What a price is for (P2).</summary>
    public static readonly string[] PriceUnits = { "event", "guest", "hour", "kg", "item" };

    /// <summary>Venues and catering price per guest, cakes per kilo, everyone else per event.</summary>
    public static string DefaultPriceUnit(string group) => group switch
    {
        "venues" => "guest",
        "cake" => "kg",
        _ => "event",
    };

    /// <summary>Styles (P3) and the groups that use them; "documentary" is photo/video only.</summary>
    public static readonly string[] Styles =
        { "classic", "modern", "minimalist", "rustic", "traditional", "romantic", "boho", "documentary" };
    public static readonly string[] StyleGroups = { "photo", "decor" };

    /// <summary>Group-specific features (P2's filters).</summary>
    public static readonly Dictionary<string, string[]> Features = new()
    {
        ["venues"] = new[] { "accommodation", "parking" },
        ["photo"] = new[] { "drone", "album", "sameDayEdit" },
        ["decor"] = Array.Empty<string>(),
        ["music"] = new[] { "folk", "pop", "jazz", "classical", "electronic" },
        ["cake"] = new[] { "delivery" },
        ["attire"] = new[] { "sale", "rental" },
        ["beauty"] = new[] { "comesToYou" },
        ["other"] = Array.Empty<string>(),
    };

    public static readonly string[] Settings = { "indoor", "outdoor", "both" };
    public static readonly string[] VenueTypes = { "restaurant", "hall", "openAir", "winery", "hotel" };
    public static readonly string[] TravelPolicies = { "included", "extra", "none" };

    public const int MaxPackages = 5;

    /// <summary>Keep only known, distinct values (in the given order).</summary>
    public static List<string> Clean(IEnumerable<string>? values, IReadOnlyCollection<string> allowed) =>
        (values ?? Enumerable.Empty<string>())
            .Select(v => v?.Trim() ?? string.Empty)
            .Where(allowed.Contains)
            .Distinct()
            .ToList();

    public static string? OneOf(string? value, IReadOnlyCollection<string> allowed) =>
        value is not null && allowed.Contains(value.Trim()) ? value.Trim() : null;
}
