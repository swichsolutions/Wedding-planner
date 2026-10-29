namespace WeddingPlanner.Domain.Entities;

/// <summary>
/// One vendor in the couple's „ჩემი მომსახურებები“ (BUILD-PLAN B4, guide §6): saved from the
/// catalog (<see cref="VendorId"/>) or found elsewhere and added by hand. It moves from saved to
/// shortlisted (being compared) to chosen, and keeps the offer and how to reach the vendor.
/// Choosing never means booked: the date is checked with the vendor (guide §9). Part of the shared
/// plan (<see cref="Couple"/>).
/// </summary>
public class PlanService
{
    public int Id { get; set; }
    public int CoupleId { get; set; }

    /// <summary>A catalog vendor; null for one added by hand (or a catalog vendor since removed).</summary>
    public int? VendorId { get; set; }
    public Vendor? Vendor { get; set; }

    /// <summary>The vendor's name (copied from the catalog, so it survives the vendor leaving).</summary>
    public string Name { get; set; } = string.Empty;
    public string? CategorySlug { get; set; }

    /// <summary>saved, shortlist or chosen.</summary>
    public string Status { get; set; } = "saved";

    // How to reach a vendor added by hand (catalog vendors show their profile's).
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Instagram { get; set; }

    /// <summary>The price offered or agreed.</summary>
    public decimal? Offer { get; set; }
    /// <summary>What the offer includes.</summary>
    public string? OfferNote { get; set; }
    public string? Note { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
