namespace WeddingPlanner.Api.Planning;

/// <summary>
/// The overview banner (B7): it changes as the couple chooses — the standard visual, then the chosen
/// venue's photo, then their colour palette, then the décor, flower, cake and table photos they
/// marked.
/// </summary>
public static class BannerRules
{
    /// <summary>Palettes a couple can pick (keys only; the colours live in the frontend's
    /// core/palettes.ts). A first set until Taso's (BUILD-PLAN B7 "You provide").</summary>
    public static readonly string[] PaletteKeys =
    {
        "ivory-sage", "blush-gold", "garnet", "dusty-blue", "terracotta", "lavender", "emerald", "mono",
    };

    public const int MaxPhotos = 24;

    /// <summary>The catalog category whose chosen vendor gives the banner its photo.</summary>
    public const string VenueCategory = "darbazi";

    /// <summary>Which vendors' photos can be marked, and as what.</summary>
    public static string? KindForCategory(string? categorySlug) => categorySlug switch
    {
        "darbazi" or "inventari" => "tables",
        "dekori" => "decor",
        "floristi" => "flowers",
        "torti" or "tkbileuli" => "cake",
        _ => null,
    };

    /// <summary>Which inspiration ideas' photos can be marked (ContentRules.InspirationTopics), and as
    /// what. Invitation designs don't belong on the banner.</summary>
    public static string? KindForTopic(string? topic) => topic switch
    {
        "decor" or "colors" or "lighting" => "decor",
        "flowers" => "flowers",
        "tables" => "tables",
        "cakes" => "cake",
        _ => null,
    };
}
