namespace WeddingPlanner.Domain.Entities;

/// <summary>
/// A family (household) on the guest list (D9): the guests invited together, who get one
/// personal RSVP link between them (B6, <see cref="InviteCode"/>). Owned by the shared plan (<see cref="Couple"/>).
/// Deleting a family keeps its guests; they're just no longer grouped.
/// </summary>
public class GuestFamily
{
    public int Id { get; set; }

    public int CoupleId { get; set; }

    /// <summary>e.g. "ბერიძეები", "ნინოს ოჯახი".</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>The family's personal invitation link code (B6).</summary>
    public string? InviteCode { get; set; }

    /// <summary>When the family last answered through the invitation; null = never.</summary>
    public DateTimeOffset? RsvpAt { get; set; }

    public string? RsvpMessage { get; set; }
    public string? RsvpAnswer { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
