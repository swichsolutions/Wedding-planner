using System.ComponentModel.DataAnnotations;

namespace WeddingPlanner.Api.Dtos;

/// <summary>The catalog side of a service: what its card shows and how to reach the vendor.</summary>
public record PlanServiceVendorDto(
    int Id,
    string Slug,
    string CategorySlug,
    string CitySlug,
    string City,
    string? PhotoUrl,
    decimal? PriceFrom,
    string PriceUnit,
    string? Phone,
    string? Instagram,
    string? Whatsapp);

/// <summary>A vendor in „ჩემი მომსახურებები“: catalog (Vendor set) or added by hand (contacts set).</summary>
public record PlanServiceDto(
    int Id,
    string Name,
    string? CategorySlug,
    string Status,
    string? Phone,
    string? Email,
    string? Instagram,
    decimal? Offer,
    string? OfferNote,
    string? Note,
    /// <summary>Saved from the catalog: name and contacts come from the profile (Vendor is null once it's unlisted).</summary>
    bool FromCatalog,
    PlanServiceVendorDto? Vendor,
    /// <summary>A budget line already carries this vendor (so "add to budget" says "update").</summary>
    int? BudgetItemId,
    DateTimeOffset CreatedAt);

/// <summary>A vendor found elsewhere, added by hand.</summary>
public class PlanServiceCreateDto
{
    [Required, MaxLength(200)] public string Name { get; set; } = string.Empty;
    [MaxLength(120)] public string? CategorySlug { get; set; }
    [MaxLength(10)] public string? Status { get; set; }
    [MaxLength(40)] public string? Phone { get; set; }
    [EmailAddress, MaxLength(256)] public string? Email { get; set; }
    [MaxLength(200)] public string? Instagram { get; set; }
    [Range(0, 999_999_999)] public decimal? Offer { get; set; }
    [MaxLength(500)] public string? OfferNote { get; set; }
    [MaxLength(1000)] public string? Note { get; set; }
}

/// <summary>
/// The whole service as edited. Name, category and contacts apply to vendors added by hand only;
/// a catalog vendor's come from its profile.
/// </summary>
public class PlanServiceUpdateDto
{
    [MaxLength(200)] public string? Name { get; set; }
    [MaxLength(120)] public string? CategorySlug { get; set; }
    [Required, MaxLength(10)] public string Status { get; set; } = "saved";
    [MaxLength(40)] public string? Phone { get; set; }
    [EmailAddress, MaxLength(256)] public string? Email { get; set; }
    [MaxLength(200)] public string? Instagram { get; set; }
    [Range(0, 999_999_999)] public decimal? Offer { get; set; }
    [MaxLength(500)] public string? OfferNote { get; set; }
    [MaxLength(1000)] public string? Note { get; set; }
}

/// <summary>Put an agreed price into the budget, with the date the next payment is due.</summary>
public class PlanServiceToBudgetDto
{
    [Range(0, 999_999_999)] public decimal Amount { get; set; }
    public DateOnly? DueDate { get; set; }
}

public record PlanServiceToBudgetResultDto(int BudgetItemId, string BudgetItemName, bool Created);
