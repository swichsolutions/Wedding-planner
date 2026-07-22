namespace Ipsum.Api.Dtos;

// Serialized as camelCase JSON (ASP.NET Core default), matching the Angular Vendor model.
// The frontend derives the category i18n key from CategorySlug, so it isn't sent here.

public record VendorPhotoDto(string Url, string? Alt, bool IsRealWedding);

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
    string? MapUrl,
    string[] StyleSlugs,
    VendorPhotoDto[] Photos,
    bool IsFeatured);
