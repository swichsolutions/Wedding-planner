namespace WeddingPlanner.Domain.Entities;

/// <summary>
/// One activity of the couple's wedding-day schedule („ქორწილის დღე“, BUILD-PLAN B2, guide §7):
/// when, what, who looks after it and how to reach them. Part of the shared plan
/// (<see cref="Couple"/>). Shown in time order; items at the same time keep <see cref="SortOrder"/>.
/// </summary>
public class WeddingDayItem
{
    public int Id { get; set; }

    /// <summary>The plan it belongs to (<see cref="Couple"/>).</summary>
    public int CoupleId { get; set; }

    /// <summary>"HH:mm", or null for "time not set yet". Hours before 05:00 count as after midnight.</summary>
    public string? Time { get; set; }

    public string Activity { get; set; } = string.Empty;
    public string? Note { get; set; }

    /// <summary>Who's responsible: free text (a partner, a vendor, the tamada…).</summary>
    public string? Who { get; set; }

    /// <summary>How to reach them: a phone number or anything else, free text.</summary>
    public string? Contact { get; set; }

    public int SortOrder { get; set; }
}
