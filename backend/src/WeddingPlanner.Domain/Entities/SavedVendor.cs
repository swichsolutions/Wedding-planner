namespace WeddingPlanner.Domain.Entities;

/// <summary>
/// Wishlist entry — a vendor saved by a couple. Owned by the AppUser (couple) via UserId,
/// mirroring <see cref="ChecklistItem"/> (no enforced FK to Identity to keep Domain clean).
/// </summary>
public class SavedVendor
{
    /// <summary>Owning couple user's id (AppUser.Id).</summary>
    public string UserId { get; set; } = string.Empty;

    public int VendorId { get; set; }
    public Vendor Vendor { get; set; } = null!;

    public DateTimeOffset CreatedAt { get; set; }
}
