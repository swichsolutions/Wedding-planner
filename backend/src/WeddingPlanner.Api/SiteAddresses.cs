namespace WeddingPlanner.Api;

/// <summary>
/// The public site's page addresses that the API has to know: for the sitemap and for the links
/// it hands out with content. The site moved to Georgian addresses in Latin letters on 2026-11-13
/// (/guides → /rchevebi, /schedules → /ganrigebi, /vendors?group=… → one segment per group); the
/// frontend redirects the old ones. The frontend owns these addresses, so every list here must
/// stay equal to its file: change both together.
/// </summary>
public static class SiteAddresses
{
    /// <summary>
    /// Catalog group key (CategoryCatalog.Groups) → its page's address segment: the group's Georgian
    /// name in Latin letters. Must match GROUP_SLUGS in frontend/src/app/core/catalog.ts.
    /// </summary>
    public static readonly IReadOnlyDictionary<string, string> GroupSlugs = new Dictionary<string, string>
    {
        ["venues"] = "sivrtseebi-da-kveba",
        ["photo"] = "foto-da-video",
        ["decor"] = "dekori-da-qvavilebi",
        ["music"] = "musika-da-gartoba",
        ["cake"] = "torti-da-tkbileuli",
        ["attire"] = "samosi",
        ["accessories"] = "aqsesuarebi",
        ["beauty"] = "silamaze-da-momzadeba",
        ["other"] = "skhva-momsakhurebebi",
    };

    /// <summary>The example day schedules' page. Must match SCHEDULES_PATH in frontend/src/app/core/schedule-addresses.ts.</summary>
    public const string Schedules = "/ganrigebi";

    /// <summary>
    /// One page per example schedule, under <see cref="Schedules"/>. Must match SCHEDULE_SLUGS in
    /// frontend/src/app/core/schedule-addresses.ts.
    /// </summary>
    public static readonly string[] ScheduleSlugs = { "khelis-motsera", "jvristsera", "mkholod-tsveuleba" };

    /// <summary>
    /// „რჩევები და იდეები“: the hub and its three sections. Must match GUIDES_PATH and KIND_SECTION
    /// in frontend/src/app/core/content.models.ts.
    /// </summary>
    public const string Guides = "/rchevebi";
    public const string Blog = Guides + "/blogi";
    public const string Inspiration = Guides + "/shtagoneba";
    public const string RealWeddings = Guides + "/realuri-qortsilebi";
}
