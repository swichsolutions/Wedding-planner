namespace WeddingPlanner.Domain.Entities;

/// <summary>
/// A message from a couple to a vendor. CoupleId is optional: couples can contact a
/// vendor via the public form without an account, in which case sender fields are filled.
/// </summary>
public class Message
{
    public int Id { get; set; }

    public int? CoupleId { get; set; }
    public Couple? Couple { get; set; }

    public int VendorId { get; set; }
    public Vendor Vendor { get; set; } = null!;

    public string? SenderName { get; set; }
    public string? SenderEmail { get; set; }
    public string? SenderPhone { get; set; }

    public string Body { get; set; } = string.Empty;
    public bool IsRead { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
