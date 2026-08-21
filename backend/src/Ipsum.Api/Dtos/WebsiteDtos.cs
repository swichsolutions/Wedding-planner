using System.ComponentModel.DataAnnotations;

namespace Ipsum.Api.Dtos;

public record WeddingSiteDto(
    string TemplateKey,
    string? FirstName,
    string? LastName,
    string? PartnerFirstName,
    string? PartnerLastName,
    DateOnly? WeddingDate,
    string? Place,
    string? Message,
    string? InkColor,
    string? AccentColor,
    string? PhotoUrl,
    bool IsPublished,
    string? Slug);

/// <summary>Full editable state — the API upserts the couple's single site with this.</summary>
public class WeddingSiteUpdateDto
{
    [Required, MaxLength(40)] public string TemplateKey { get; set; } = string.Empty;
    [MaxLength(120)] public string? FirstName { get; set; }
    [MaxLength(120)] public string? LastName { get; set; }
    [MaxLength(120)] public string? PartnerFirstName { get; set; }
    [MaxLength(120)] public string? PartnerLastName { get; set; }
    public DateOnly? WeddingDate { get; set; }
    [MaxLength(200)] public string? Place { get; set; }
    [MaxLength(2000)] public string? Message { get; set; }
    [RegularExpression("^#[0-9a-fA-F]{6}$")] public string? InkColor { get; set; }
    [RegularExpression("^#[0-9a-fA-F]{6}$")] public string? AccentColor { get; set; }
}

/// <summary>What a published site exposes publicly — no owner/account information.</summary>
public record PublicSiteDto(
    string TemplateKey,
    string? FirstName,
    string? PartnerFirstName,
    DateOnly? WeddingDate,
    string? Place,
    string? Message,
    string? InkColor,
    string? AccentColor,
    string? PhotoUrl);

/// <summary>One row of the guest-facing "find a couple's website" search.</summary>
public record SiteSearchResultDto(
    string? FirstName,
    string? LastName,
    string? PartnerFirstName,
    string? PartnerLastName,
    DateOnly WeddingDate,
    string? Place,
    string Slug);
