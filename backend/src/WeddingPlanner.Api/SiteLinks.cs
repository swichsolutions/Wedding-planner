namespace WeddingPlanner.Api;

/// <summary>The public site's address and name, for links and mail the API sends out.</summary>
public static class SiteLinks
{
    /// <summary>
    /// Where links point: configuration only, never the request's Host header — a forged
    /// Host would mail the victim a link to someone else's site, handing over the token.
    /// </summary>
    public static string FrontendOrigin(IConfiguration config)
    {
        var origin = config["Site:PublicOrigin"];
        if (string.IsNullOrWhiteSpace(origin))
            origin = config.GetSection("Cors:AllowedOrigins").Get<string[]>()
                ?.FirstOrDefault(o => !string.IsNullOrWhiteSpace(o));
        return (origin ?? "http://localhost:4200").TrimEnd('/');
    }

    /// <summary>The brand in mail; a placeholder until named, same as brand.name in the frontend i18n.</summary>
    public static string Brand(IConfiguration config) =>
        config["Site:Name"] is { Length: > 0 } name && !string.IsNullOrWhiteSpace(name) ? name : "WeddingPlanner";
}
