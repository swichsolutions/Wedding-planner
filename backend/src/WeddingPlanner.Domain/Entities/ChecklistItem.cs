namespace WeddingPlanner.Domain.Entities;

/// <summary>
/// One of the couple's tasks („დავალებები“, BUILD-PLAN B3, guide §6). Belongs to the shared plan
/// (<see cref="Couple"/>). Grouped by <see cref="Stage"/>; its deadline is <see cref="DueDate"/> if
/// set, otherwise counted back from the wedding date by the stage (client-side).
/// </summary>
public class ChecklistItem
{
    public int Id { get; set; }

    /// <summary>The plan it belongs to (<see cref="Couple"/>, shared by both partners).</summary>
    public int CoupleId { get; set; }

    public string Title { get; set; } = string.Empty;
    public bool IsDone { get; set; }
    public int SortOrder { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>When in the planning it belongs: m12, m10, m8, m6, m4, m2, m1, w1, after (null = no stage).</summary>
    public string? Stage { get; set; }

    /// <summary>A date the couple set themselves, instead of the stage's.</summary>
    public DateOnly? DueDate { get; set; }

    /// <summary>Who's doing it (free text).</summary>
    public string? Who { get; set; }

    /// <summary>
    /// Where the task opens, from the starter list: budget, guests, settings, invitation, day,
    /// seating, services, or catalog:&lt;category slug&gt;.
    /// </summary>
    public string? Link { get; set; }
}
