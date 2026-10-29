namespace WeddingPlanner.Domain.Entities;

/// <summary>
/// The shared wedding plan (BUILD-PLAN B1, decision D8): the couple's details plus everything the
/// organizer keeps (checklist, budget, guests, seating, invitation, saved vendors all hang off
/// <see cref="Id"/>). Up to two accounts work on it through <see cref="Members"/>; a partner joins
/// with a <see cref="CoupleInvite"/>. Every couple account belongs to exactly one plan.
/// </summary>
public class Couple
{
    public int Id { get; set; }

    // The two people. The account that created the plan is First/LastName; the partner who
    // joined is PartnerFirst/LastName (CoupleMember.IsPartner).
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? PartnerFirstName { get; set; }
    public string? PartnerLastName { get; set; }

    /// <summary>Wedding date; null = not decided yet ("ჯერ არ ვიცი").</summary>
    public DateOnly? WeddingDate { get; set; }

    /// <summary>Where: a city or village (free text) and its region key (catalog regions).</summary>
    public string? City { get; set; }
    public string? Region { get; set; }

    /// <summary>Where they are in planning, e.g. "engaged", "venueBooked" (onboarding option key).</summary>
    public string? PlanningStage { get; set; }

    /// <summary>Guest-count bucket, e.g. "51-100", "300plus", "notSure".</summary>
    public string? GuestCountRange { get; set; }

    /// <summary>Vendor category slugs the couple says they'll need (from the catalog).</summary>
    public List<string> NeededCategories { get; set; } = new();

    public decimal? TotalBudget { get; set; }

    /// <summary>The colour palette the couple picked for their wedding (B7 banner); null = none yet.</summary>
    public string? PaletteKey { get; set; }

    /// <summary>The venue's floor plan (an image the couple uploads), drawn under the seating chart.</summary>
    public string? FloorPlanUrl { get; set; }
    public string? FloorPlanStorageId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public ICollection<CoupleMember> Members { get; set; } = new List<CoupleMember>();
}
