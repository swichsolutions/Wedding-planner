namespace WeddingPlanner.Domain.Entities;

/// <summary>
/// An account working on a plan. Keyed by the user: one plan per account. A plan has at most two
/// members (the couple). No FK to Identity, to keep Domain free of it (like the rest).
/// </summary>
public class CoupleMember
{
    /// <summary>AppUser.Id.</summary>
    public string UserId { get; set; } = string.Empty;

    public int CoupleId { get; set; }
    public Couple Couple { get; set; } = null!;

    /// <summary>Joined by invitation: their name is the plan's PartnerFirst/LastName.</summary>
    public bool IsPartner { get; set; }

    public DateTimeOffset JoinedAt { get; set; }
}
