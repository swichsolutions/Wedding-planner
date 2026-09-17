namespace WeddingPlanner.Domain.Entities;

public enum AvailabilityStatus
{
    Available = 0,
    Booked = 1,
    Tentative = 2
}

/// <summary>Optional, manually-maintained per-date availability for a vendor.</summary>
public class Availability
{
    public int Id { get; set; }
    public int VendorId { get; set; }
    public Vendor Vendor { get; set; } = null!;

    public DateOnly Date { get; set; }
    public AvailabilityStatus Status { get; set; }
}
