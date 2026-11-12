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

    /// <summary>
    /// City slug (<see cref="Slugs.From"/>) → region, for vendors who have a city but never chose
    /// a region: the region filter finds them through this. Only places that belong to one region
    /// without doubt; both spellings where the Georgian and the English name give different slugs.
    /// </summary>
    private static readonly Dictionary<string, string> CityRegions = new()
    {
        ["tbilisi"] = "tbilisi",
        ["batumi"] = "adjara", ["kobuleti"] = "adjara", ["qobuleti"] = "adjara",
        ["kutaisi"] = "imereti", ["qutaisi"] = "imereti", ["zestaponi"] = "imereti",
        ["tskaltubo"] = "imereti", ["tsqaltubo"] = "imereti",
        ["telavi"] = "kakheti", ["sighnaghi"] = "kakheti", ["signagi"] = "kakheti", ["kvareli"] = "kakheti",
        ["qvareli"] = "kakheti", ["gurjaani"] = "kakheti", ["lagodekhi"] = "kakheti", ["sagarejo"] = "kakheti",
        ["tsinandali"] = "kakheti",
        ["mtskheta"] = "mtskheta-mtianeti", ["dusheti"] = "mtskheta-mtianeti", ["gudauri"] = "mtskheta-mtianeti",
        ["stepantsminda"] = "mtskheta-mtianeti", ["kazbegi"] = "mtskheta-mtianeti", ["qazbegi"] = "mtskheta-mtianeti",
        ["rustavi"] = "kvemo-kartli", ["marneuli"] = "kvemo-kartli", ["bolnisi"] = "kvemo-kartli",
        ["gori"] = "shida-kartli", ["khashuri"] = "shida-kartli",
        ["akhaltsikhe"] = "samtskhe-javakheti", ["borjomi"] = "samtskhe-javakheti", ["bakuriani"] = "samtskhe-javakheti",
        ["zugdidi"] = "samegrelo-zemo-svaneti", ["poti"] = "samegrelo-zemo-svaneti", ["mestia"] = "samegrelo-zemo-svaneti",
        ["ozurgeti"] = "guria",
        ["ambrolauri"] = "racha-lechkhumi", ["oni"] = "racha-lechkhumi",
    };

    /// <summary>The city slugs known to lie in a region (an array, so a query can use Contains).</summary>
    public static string[] CitySlugsIn(string region) =>
        CityRegions.Where(c => c.Value == region).Select(c => c.Key).ToArray();

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
        ["accessories"] = Array.Empty<string>(),
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
