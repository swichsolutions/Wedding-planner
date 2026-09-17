namespace WeddingPlanner.Api.Dtos;

// Serialized as camelCase JSON (ASP.NET Core default), matching the Angular Vendor model.
// The frontend derives the category i18n key from CategorySlug, so it isn't sent here.

public record VendorPhotoDto(string Url, string? Alt, bool IsRealWedding);

/// <summary>One category×city grouping of approved vendors — feeds the SEO landing
/// pages' cross-links and the sitemap.</summary>
public record VendorPairingDto(string CategorySlug, string CitySlug, string City, int Count);

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
    int ReviewCount);
