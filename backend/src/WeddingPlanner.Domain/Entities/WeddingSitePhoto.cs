namespace WeddingPlanner.Domain.Entities;

/// <summary>An extra photo on the invitation (B6 design step), shown below the details. The main
/// photo stays on <see cref="WeddingSite.PhotoUrl"/>.</summary>
public class WeddingSitePhoto
{
    public int Id { get; set; }

    public int WeddingSiteId { get; set; }

    public string Url { get; set; } = string.Empty;

    public string StorageId { get; set; } = string.Empty;

    public int SortOrder { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
