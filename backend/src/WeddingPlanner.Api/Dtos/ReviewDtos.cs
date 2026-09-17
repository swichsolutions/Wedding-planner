using System.ComponentModel.DataAnnotations;

namespace WeddingPlanner.Api.Dtos;

public record ReviewDto(
    int Id,
    string AuthorName,
    int Rating,
    string? Body,
    DateTimeOffset CreatedAt,
    bool Mine);

public class SubmitReviewDto
{
    [Range(1, 5)] public int Rating { get; set; }
    [MaxLength(2000)] public string? Body { get; set; }
}
