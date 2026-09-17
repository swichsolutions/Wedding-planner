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
    VendorPhotoDto[] Photos);

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
    DateTimeOffset CreatedAt);
