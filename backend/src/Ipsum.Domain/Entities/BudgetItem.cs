namespace Ipsum.Domain.Entities;

/// <summary>
/// One line of a couple's wedding budget (venue, photographer, cake, …). Owned by the
/// AppUser (couple) via UserId, like <see cref="ChecklistItem"/> — no FK to Identity.
/// A row can point at a directory vendor (VendorId) or a free-text merchant, not both.
/// </summary>
public class BudgetItem
{
    public int Id { get; set; }

    /// <summary>Owning couple user's id (AppUser.Id).</summary>
    public string UserId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Vendor category slug (e.g. "fotografi") — drives the "top matches" suggestion link.
    /// Null for custom items with no directory category (e.g. invitations).
    /// </summary>
    public string? CategorySlug { get; set; }

    /// <summary>Vendor chosen from the directory; cleared (SetNull) if the vendor is removed.</summary>
    public int? VendorId { get; set; }
    public Vendor? Vendor { get; set; }

    /// <summary>Free-text vendor/merchant for businesses not on the platform.</summary>
    public string? MerchantName { get; set; }

    public decimal? Estimate { get; set; }
    public decimal? ActualCost { get; set; }
    public decimal? Paid { get; set; }

    public string? Note { get; set; }

    /// <summary>Payment-reminder date; surfaced in the UI when close/overdue.</summary>
    public DateOnly? ReminderDate { get; set; }

    /// <summary>
    /// Share of the total budget for seeded rows (Georgian wedding norms) — used to
    /// recompute estimates when the couple changes their total. Null for custom rows.
    /// </summary>
    public int? DefaultPct { get; set; }

    /// <summary>
    /// The couple typed their own estimate — the row stops following the total budget's
    /// suggested split until an explicit reset.
    /// </summary>
    public bool EstimateEdited { get; set; }

    public int SortOrder { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
