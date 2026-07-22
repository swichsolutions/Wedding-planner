namespace Ipsum.Domain.Entities;

/// <summary>
/// A couple's wedding-planning checklist item. Owned by the AppUser (couple) via UserId.
/// </summary>
public class ChecklistItem
{
    public int Id { get; set; }

    /// <summary>Owning user's id (AppUser.Id). No enforced FK to keep Domain free of Identity.</summary>
    public string UserId { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;
    public bool IsDone { get; set; }
    public int SortOrder { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
