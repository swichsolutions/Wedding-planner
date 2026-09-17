namespace WeddingPlanner.Domain.Entities;

public enum ContentPageType
{
    Guide = 0,
    Checklist = 1,
    RealWedding = 2
}

/// <summary>
/// SEO/content surface — planning guides, checklists, real-wedding features.
/// A first-class part of the product (see CLAUDE.md §3, §5), bilingual.
/// </summary>
public class ContentPage
{
    public int Id { get; set; }
    public string Slug { get; set; } = string.Empty;

    public string TitleKa { get; set; } = string.Empty;
    public string TitleEn { get; set; } = string.Empty;
    public string? BodyKa { get; set; }
    public string? BodyEn { get; set; }

    public string? MetaDescriptionKa { get; set; }
    public string? MetaDescriptionEn { get; set; }

    public ContentPageType Type { get; set; }
    public bool IsPublished { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }
}
