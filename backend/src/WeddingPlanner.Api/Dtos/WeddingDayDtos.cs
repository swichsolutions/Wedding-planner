using System.ComponentModel.DataAnnotations;

namespace WeddingPlanner.Api.Dtos;

public record WeddingDayItemDto(int Id, string? Time, string Activity, string? Note, string? Who, string? Contact, int SortOrder);

/// <summary>One activity as typed in (create or edit). Time is "HH:mm" or empty.</summary>
public class WeddingDayItemEditDto
{
    [RegularExpression(@"^([01]\d|2[0-3]):[0-5]\d$")] public string? Time { get; set; }
    [Required, MaxLength(200)] public string Activity { get; set; } = string.Empty;
    [MaxLength(500)] public string? Note { get; set; }
    [MaxLength(120)] public string? Who { get; set; }
    [MaxLength(120)] public string? Contact { get; set; }
}

/// <summary>
/// „გამოიყენე ეს განრიგი“: the example's rows (in the reader's language, from the frontend's
/// day-schedules.ts). Replace drops what's there first; otherwise the rows are added.
/// </summary>
public class WeddingDayTemplateDto
{
    [Required, MaxLength(60)] public List<WeddingDayItemEditDto> Rows { get; set; } = new();
    public bool Replace { get; set; }
}

public class WeddingDayOrderDto
{
    [MaxLength(200)] public int[] Ids { get; set; } = Array.Empty<int>();
}
