namespace WeddingPlanner.Api.Dtos;

// Serialized as camelCase JSON (ASP.NET Core default), matching the Angular Vendor model.
// The frontend derives the category i18n key from CategorySlug, so it isn't sent here.

/// <summary>Id: couples mark portfolio photos for their banner by it (B7).</summary>
public record VendorPhotoDto(int Id, string Url, string? Alt, bool IsRealWedding);

/// <summary>One category×city grouping of approved vendors — feeds the SEO landing
/// pages' cross-links and the sitemap.</summary>
public record VendorPairingDto(string CategorySlug, string CitySlug, string City, int Count);

/// <summary>Per-category inventory for the home-page index: approved count, cheapest
/// starting price (null when no vendor lists one) and the cities served, busiest first.</summary>
public record CategoryStatDto(string CategorySlug, int Count, decimal? PriceMin, IReadOnlyList<CategoryCityDto> Cities);

public record CategoryCityDto(string CitySlug, string City, int Count);

public record VendorPackageDto(string Name, decimal? Price, string PriceUnit, string? Included, string? Duration);

/// <summary>A vendor's terms (information only — payments stay between couple and vendor).</summary>
public record VendorTermsDto(string? Deposit, string? Cancellation, string? TravelPolicy, string? BookingLeadTime);

public record VendorDto(
    int Id,
    string Name,
    string Slug,
    string CategorySlug,
    string City,
    string CitySlug,
    string? AreasServed,
    decimal PriceFrom,
    string? PriceRange,
    string Bio,
    string? Instagram,
    string? Facebook,
    string? Phone,
    string? Whatsapp,
    string? MapUrl,
    VendorPhotoDto[] Photos,
    bool IsFeatured,
    double? Rating,
    int ReviewCount,
    // ---- catalog attributes (PROPOSALS.md P1–P5) ----
    string Group,
    string PriceUnit,
    string? Region,
    string[] ServedRegions,
    string[] AlsoOffers,
    string[] Styles,
    string[] Features,
    int? CapacityMin,
    int? CapacityMax,
    string? Setting,
    string? VenueType,
    /// <summary>Profile only (null in lists).</summary>
    VendorTermsDto? Terms,
    /// <summary>Profile only (empty in lists).</summary>
    VendorPackageDto[] Packages,
    /// <summary>
    /// Profile only (false in lists): a vendor account reads the inbox. Admin-added profiles have no
    /// owner yet, so they show their phone and links but no message form.
    /// </summary>
    bool AcceptsMessages,
    /// <summary>Profile only (null in lists): the venue's floor plan image, when it has one.</summary>
    string? FloorPlanUrl);
