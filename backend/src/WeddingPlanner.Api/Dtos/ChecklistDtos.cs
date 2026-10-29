using System.ComponentModel.DataAnnotations;

namespace WeddingPlanner.Api.Dtos;

/// <summary>A task (B3). DueDate is the couple's own date; otherwise the stage decides it.</summary>
public record ChecklistItemDto(
    int Id,
    string Title,
    bool IsDone,
    int SortOrder,
    string? Stage,
    DateOnly? DueDate,
    string? Who,
    string? Link);

/// <summary>A task as the couple types it in. Unknown stages are stored as "no stage".</summary>
public class ChecklistCreateDto
{
    [Required, MaxLength(300)] public string Title { get; set; } = string.Empty;
    [MaxLength(10)] public string? Stage { get; set; }
    public DateOnly? DueDate { get; set; }
    [MaxLength(120)] public string? Who { get; set; }
}

/// <summary>The whole task as edited (the client sends every field; blank title keeps the old one).</summary>
public class ChecklistUpdateDto
{
    [MaxLength(300)] public string? Title { get; set; }
    public bool IsDone { get; set; }
    [MaxLength(10)] public string? Stage { get; set; }
    public DateOnly? DueDate { get; set; }
    [MaxLength(120)] public string? Who { get; set; }
}
