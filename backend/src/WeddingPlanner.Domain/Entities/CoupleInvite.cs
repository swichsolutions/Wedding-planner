namespace WeddingPlanner.Domain.Entities;

/// <summary>
/// A partner invitation to a plan: a single-use link (and, when email is set up, an email). Only
/// the SHA-256 of the token is stored, so the database never holds a usable link. A plan has at
/// most one open invite; making a new one replaces it.
/// </summary>
public class CoupleInvite
{
    public int Id { get; set; }

    public int CoupleId { get; set; }
    public Couple Couple { get; set; } = null!;

    /// <summary>Hex SHA-256 of the token in the link.</summary>
    public string TokenHash { get; set; } = string.Empty;

    /// <summary>Where it was emailed, if it was.</summary>
    public string? Email { get; set; }

    public string CreatedByUserId { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }

    public DateTimeOffset? AcceptedAt { get; set; }
    public string? AcceptedByUserId { get; set; }
}
