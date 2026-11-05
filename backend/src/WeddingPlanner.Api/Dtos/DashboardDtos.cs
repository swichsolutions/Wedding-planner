using System.ComponentModel.DataAnnotations;

namespace WeddingPlanner.Api.Dtos;

/// <summary>Editable vendor fields (structural fields like slug/category/city are fixed for now).</summary>
public class VendorEditDto
{
    [Required, MaxLength(200)] public string Name { get; set; } = string.Empty;
    [MaxLength(120)] public string? City { get; set; }
    [MaxLength(4000)] public string? Bio { get; set; }
    public decimal? PriceMin { get; set; }
    [MaxLength(120)] public string? PriceRange { get; set; }
    [MaxLength(200)] public string? Instagram { get; set; }
    [MaxLength(200)] public string? Facebook { get; set; }
    [MaxLength(40)] public string? Phone { get; set; }
    /// <summary>Accepts a phone number or a pasted wa.me link; normalized server-side.</summary>
    [MaxLength(200)] public string? Whatsapp { get; set; }
    [MaxLength(1000)] public string? MapUrl { get; set; }
    [MaxLength(500)] public string? AreasServed { get; set; }

    // ---- catalog attributes (PROPOSALS.md P2–P5); unknown values are dropped server-side ----
    [MaxLength(10)] public string? PriceUnit { get; set; }
    [MaxLength(40)] public string? Region { get; set; }
    [MaxLength(20)] public List<string>? ServedRegions { get; set; }
    [MaxLength(10)] public List<string>? AlsoOffers { get; set; }
    [MaxLength(10)] public List<string>? Styles { get; set; }
    [MaxLength(10)] public List<string>? Features { get; set; }
    [Range(1, 5000)] public int? CapacityMin { get; set; }
    [Range(1, 5000)] public int? CapacityMax { get; set; }
    [MaxLength(10)] public string? Setting { get; set; }
    [MaxLength(20)] public string? VenueType { get; set; }
    [MaxLength(200)] public string? DepositTerms { get; set; }
    [MaxLength(500)] public string? CancellationTerms { get; set; }
    [MaxLength(10)] public string? TravelPolicy { get; set; }
    [MaxLength(100)] public string? BookingLeadTime { get; set; }
    /// <summary>The full package list (replaces what's saved); at most 5.</summary>
    [MaxLength(5)] public List<VendorPackageEditDto>? Packages { get; set; }
}

public class VendorPackageEditDto
{
    [Required, MaxLength(120)] public string Name { get; set; } = string.Empty;
    [Range(0, 10_000_000)] public decimal? Price { get; set; }
    [MaxLength(10)] public string? PriceUnit { get; set; }
    [MaxLength(1000)] public string? Included { get; set; }
    [MaxLength(60)] public string? Duration { get; set; }
}

public record VendorDashboardDto(
    int Id,
    string Name,
    string Slug,
    string CategorySlug,
    string City,
    string CitySlug,
    bool IsApproved,
    bool IsFeatured,
    string? Bio,
    decimal? PriceMin,
    string? PriceRange,
    string? Instagram,
    string? Facebook,
    string? Phone,
    string? Whatsapp,
    string? MapUrl,
    string? AreasServed,
    VendorPhotoDto[] Photos,
    string Group,
    string? PriceUnit,
    string? Region,
    string[] ServedRegions,
    string[] AlsoOffers,
    string[] Styles,
    string[] Features,
    int? CapacityMin,
    int? CapacityMax,
    string? Setting,
    string? VenueType,
    string? DepositTerms,
    string? CancellationTerms,
    string? TravelPolicy,
    string? BookingLeadTime,
    VendorPackageEditDto[] Packages,
    /// <summary>The venue's floor plan image, if one was uploaded (venues only).</summary>
    string? FloorPlanUrl);

public record VendorFloorPlanDto(string? FloorPlanUrl);

public record InboxMessageDto(
    int Id,
    string? SenderName,
    string? SenderEmail,
    string? SenderPhone,
    string Body,
    bool IsRead,
    DateTimeOffset CreatedAt);

public record VendorStatsDto(int TotalViews, int TotalContacts, int TotalMessages, int UnreadMessages);

public record VendorPhotoAdminDto(int Id, string Url, string? Alt, bool IsRealWedding, int SortOrder);

public class PhotoUpdateDto
{
    [MaxLength(300)] public string? Alt { get; set; }
    public bool IsRealWedding { get; set; }
}

public class PhotoReorderDto
{
    public int[] Ids { get; set; } = Array.Empty<int>();
}

public record AdminVendorDto(
    int Id,
    string Name,
    string CategorySlug,
    string City,
    bool IsApproved,
    bool IsFeatured,
    DateTimeOffset CreatedAt,
    string Slug,
    string CitySlug,
    /// <summary>A vendor account manages the profile (false for imported, unclaimed ones).</summary>
    bool HasOwner,
    int PhotoCount);
