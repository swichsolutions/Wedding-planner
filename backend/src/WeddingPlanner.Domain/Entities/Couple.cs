namespace WeddingPlanner.Domain.Entities;

/// <summary>
/// A couple's planning profile, captured during multi-step onboarding. Owned by the AppUser
/// (couple) via UserId — like <see cref="ChecklistItem"/>/<see cref="SavedVendor"/>, no FK to
/// Identity, to keep Domain clean. One row per couple account.
/// </summary>
public class Couple
{
    public int Id { get; set; }

    /// <summary>Owning couple user's id (AppUser.Id).</summary>
    public string UserId { get; set; } = string.Empty;

    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? PartnerFirstName { get; set; }
    public string? PartnerLastName { get; set; }

    public string Email { get; set; } = string.Empty;

    /// <summary>Wedding date; null = not decided yet ("we're still deciding").</summary>
    public DateOnly? WeddingDate { get; set; }

    /// <summary>Where they are in planning, e.g. "engaged", "venueBooked" (onboarding option key).</summary>
    public string? PlanningStage { get; set; }

    /// <summary>Guest-count bucket, e.g. "51-100", "300plus", "notSure".</summary>
    public string? GuestCountRange { get; set; }

    /// <summary>Vendor category slugs the couple says they'll need (from the catalog).</summary>
    public List<string> NeededCategories { get; set; } = new();

    public decimal? TotalBudget { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
