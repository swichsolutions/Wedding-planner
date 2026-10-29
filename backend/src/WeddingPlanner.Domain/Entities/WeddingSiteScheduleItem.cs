namespace WeddingPlanner.Domain.Entities;

/// <summary>
/// One line of the invitation's short schedule for guests (B6 extra details), e.g. "16:00 ·
/// ჯვრისწერა". Separate from the couple's own day plan (<see cref="WeddingDayItem"/>), which holds
/// vendor contacts and other things guests don't need.
/// </summary>
public class WeddingSiteScheduleItem
{
    public int Id { get; set; }

    public int WeddingSiteId { get; set; }

    /// <summary>"HH:mm", or null when the line has no time.</summary>
    public string? Time { get; set; }

    public string Text { get; set; } = string.Empty;

    public int SortOrder { get; set; }
}
