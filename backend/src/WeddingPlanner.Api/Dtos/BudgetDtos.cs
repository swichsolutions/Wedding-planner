using System.ComponentModel.DataAnnotations;

namespace WeddingPlanner.Api.Dtos;

/// <summary>Directory vendor linked to a budget row — enough to render a profile link.</summary>
public record BudgetVendorRefDto(int Id, string Name, string CategorySlug, string CitySlug, string Slug);

public record BudgetItemDto(
    int Id,
    string Name,
    string? CategorySlug,
    BudgetVendorRefDto? Vendor,
    string? MerchantName,
    decimal? Estimate,
    decimal? ActualCost,
    decimal? Paid,
    string? Note,
    DateOnly? ReminderDate,
    int SortOrder);

public record BudgetDto(decimal? TotalBudget, IReadOnlyList<BudgetItemDto> Items);

public class BudgetItemCreateDto
{
    [Required, MaxLength(200)] public string Name { get; set; } = string.Empty;
    [MaxLength(120)] public string? CategorySlug { get; set; }
    [Range(0, 999_999_999)] public decimal? Estimate { get; set; }
}

/// <summary>Full-row replace — the client always sends the complete editable state.</summary>
public class BudgetItemUpdateDto
{
    [Required, MaxLength(200)] public string Name { get; set; } = string.Empty;
    public int? VendorId { get; set; }
    [MaxLength(200)] public string? MerchantName { get; set; }
    [Range(0, 999_999_999)] public decimal? Estimate { get; set; }
    [Range(0, 999_999_999)] public decimal? ActualCost { get; set; }
    [Range(0, 999_999_999)] public decimal? Paid { get; set; }
    [MaxLength(1000)] public string? Note { get; set; }
    public DateOnly? ReminderDate { get; set; }
}

public class BudgetTotalUpdateDto
{
    [Range(0, 999_999_999)] public decimal? TotalBudget { get; set; }

    /// <summary>Recompute estimates of seeded rows still following the split (not hand-edited).</summary>
    public bool ApplyEstimates { get; set; }

    /// <summary>Force ALL seeded rows back to the suggested split, clearing hand edits.</summary>
    public bool ResetEstimates { get; set; }
}

/// <summary>A dated payment reminder — consumed by the planning page's reminders panel.</summary>
public record BudgetReminderDto(
    int Id,
    string Name,
    DateOnly ReminderDate,
    decimal? Estimate,
    decimal? ActualCost,
    decimal? Paid);

public class BudgetReorderDto
{
    /// <summary>Every item id of the couple's budget, in the new display order.</summary>
    [Required] public List<int> ItemIds { get; set; } = new();
}
