using System.ComponentModel.DataAnnotations;

namespace Ipsum.Api.Dtos;

public record ChecklistItemDto(int Id, string Title, bool IsDone, int SortOrder);

public class ChecklistCreateDto
{
    [Required, MaxLength(300)] public string Title { get; set; } = string.Empty;
}

public class ChecklistUpdateDto
{
    [MaxLength(300)] public string? Title { get; set; }
    public bool IsDone { get; set; }
}
