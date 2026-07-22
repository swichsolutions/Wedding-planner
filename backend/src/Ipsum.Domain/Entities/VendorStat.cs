namespace Ipsum.Domain.Entities;

/// <summary>
/// Per-day per-vendor engagement counters. Collected silently from day one — this is
/// the future sales tool for selling featured placement (see CLAUDE.md §4 / §5).
/// </summary>
public class VendorStat
{
    public int Id { get; set; }
    public int VendorId { get; set; }
    public Vendor Vendor { get; set; } = null!;

    public DateOnly Date { get; set; }
    public int ProfileViews { get; set; }
    public int ContactClicks { get; set; }
    public int Messages { get; set; }
}
