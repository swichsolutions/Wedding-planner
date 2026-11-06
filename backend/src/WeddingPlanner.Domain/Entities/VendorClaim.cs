namespace WeddingPlanner.Domain.Entities;

/// <summary>
/// A vendor account's request to take over a profile the platform added (BUILD-PLAN A3):
/// the vendor registers, points at the listing, and an admin links the two after checking
/// (a call to the listed phone). Until then the account has no vendor of its own.
/// </summary>
public class VendorClaim
{
    public int Id { get; set; }
    public int VendorId { get; set; }
    public Vendor Vendor { get; set; } = null!;
    /// <summary>The claimant's user id (AspNetUsers.Id).</summary>
    public string UserId { get; set; } = string.Empty;
    public string UserEmail { get; set; } = string.Empty;
    public VendorClaimStatus Status { get; set; } = VendorClaimStatus.Pending;
    /// <summary>The registration email equals the listing's contact email: a hint for the admin, not proof.</summary>
    public bool EmailMatches { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? DecidedAt { get; set; }
}

public enum VendorClaimStatus
{
    Pending,
    Approved,
    Rejected,
}
