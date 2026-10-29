using System.ComponentModel.DataAnnotations;

namespace WeddingPlanner.Api.Dtos;

// ---- public ----

/// <summary>A content card: list pages, related items.</summary>
public record ContentSummaryDto(
    string Slug,
    string Type,
    string? Topic,
    string TitleKa,
    string? TitleEn,
    string? ExcerptKa,
    string? ExcerptEn,
    string? CoverUrl,
    string? CoverAltKa,
    string? CoverAltEn,
    DateTimeOffset? PublishedAt);

public record ContentPhotoDto(int Id, string Url, string AltKa, string? AltEn, int SortOrder);

/// <summary>A credited vendor. VendorPath is set only while the vendor has a public profile.</summary>
public record ContentCreditDto(string Name, string RoleKa, string? RoleEn, string? VendorPath);

public record ContentDetailDto(
    ContentSummaryDto Summary,
    string? BodyKa,
    string? BodyEn,
    string? MetaDescriptionKa,
    string? MetaDescriptionEn,
    string? ActionPath,
    string? ActionLabelKa,
    string? ActionLabelEn,
    DateTimeOffset? UpdatedAt,
    IReadOnlyList<ContentPhotoDto> Photos,
    IReadOnlyList<ContentCreditDto> Credits,
    IReadOnlyList<ContentSummaryDto> Related);

// ---- admin ----

public record AdminContentRowDto(
    int Id,
    string Type,
    string Slug,
    string? Topic,
    string TitleKa,
    bool IsPublished,
    DateTimeOffset? PublishedAt,
    DateTimeOffset? UpdatedAt,
    int PhotoCount);

public record AdminCreditDto(int? VendorId, string Name, string RoleKa, string? RoleEn);

public record AdminContentDto(
    int Id,
    string Type,
    string Slug,
    string? Topic,
    string TitleKa,
    string? TitleEn,
    string? ExcerptKa,
    string? ExcerptEn,
    string? BodyKa,
    string? BodyEn,
    string? MetaDescriptionKa,
    string? MetaDescriptionEn,
    string? ActionPath,
    string? ActionLabelKa,
    string? ActionLabelEn,
    string? ConsentNote,
    bool IsPublished,
    DateTimeOffset? PublishedAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt,
    IReadOnlyList<ContentPhotoDto> Photos,
    IReadOnlyList<AdminCreditDto> Credits,
    string PublicPath);

public class SaveContentDto
{
    /// <summary>article | inspiration | real-wedding | legal</summary>
    [Required, MaxLength(20)] public string Type { get; set; } = string.Empty;

    /// <summary>Optional: made from the Georgian title when empty.</summary>
    [MaxLength(120)] public string? Slug { get; set; }
    [MaxLength(40)] public string? Topic { get; set; }

    [Required, MaxLength(300)] public string TitleKa { get; set; } = string.Empty;
    [MaxLength(300)] public string? TitleEn { get; set; }
    [MaxLength(500)] public string? ExcerptKa { get; set; }
    [MaxLength(500)] public string? ExcerptEn { get; set; }
    [MaxLength(100_000)] public string? BodyKa { get; set; }
    [MaxLength(100_000)] public string? BodyEn { get; set; }
    [MaxLength(320)] public string? MetaDescriptionKa { get; set; }
    [MaxLength(320)] public string? MetaDescriptionEn { get; set; }

    [MaxLength(300)] public string? ActionPath { get; set; }
    [MaxLength(80)] public string? ActionLabelKa { get; set; }
    [MaxLength(80)] public string? ActionLabelEn { get; set; }

    [MaxLength(500)] public string? ConsentNote { get; set; }
    public bool IsPublished { get; set; }

    [MaxLength(40)] public List<SaveCreditDto>? Credits { get; set; }
}

public class SaveCreditDto
{
    /// <summary>Set when the vendor is on the platform; the name then defaults to theirs.</summary>
    public int? VendorId { get; set; }
    [MaxLength(200)] public string? Name { get; set; }
    [Required, MaxLength(80)] public string RoleKa { get; set; } = string.Empty;
    [MaxLength(80)] public string? RoleEn { get; set; }
}

public class ContentPhotoAltDto
{
    [Required, MaxLength(300)] public string AltKa { get; set; } = string.Empty;
    [MaxLength(300)] public string? AltEn { get; set; }
}

public class ContentPhotoOrderDto
{
    [Required] public int[] Ids { get; set; } = Array.Empty<int>();
}
