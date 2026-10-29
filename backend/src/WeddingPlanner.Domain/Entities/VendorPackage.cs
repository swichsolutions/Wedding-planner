namespace WeddingPlanner.Domain.Entities;

/// <summary>
/// One of a vendor's packages (up to 5; PROPOSALS.md P5): a name, a price for a unit, and what's
/// included. Information only — no booking or payment goes through the platform.
/// </summary>
public class VendorPackage
{
    public int Id { get; set; }
    public int VendorId { get; set; }
    public Vendor Vendor { get; set; } = null!;

    public string Name { get; set; } = string.Empty;
    public decimal? Price { get; set; }
    /// <summary>event, guest, hour, kg, item.</summary>
    public string? PriceUnit { get; set; }
    /// <summary>What's included, one item per line.</summary>
    public string? Included { get; set; }
    /// <summary>When it applies, e.g. "8 საათი".</summary>
    public string? Duration { get; set; }
    public int SortOrder { get; set; }
}
