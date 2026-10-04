namespace WeddingPlanner.Domain.Entities;

/// <summary>One guest (party) on a couple's guest list. Owned by the AppUser (couple)
/// via UserId, like <see cref="ChecklistItem"/> — no Couple row required. A row can
/// also carry an optional plus-one and/or child travelling with the same guest,
/// rather than modelling them as separate linked guest rows.</summary>
public class Guest
{
    public int Id { get; set; }

    public string UserId { get; set; } = string.Empty;

    public string FirstName { get; set; } = string.Empty;

    public string? LastName { get; set; }

    public string? Email { get; set; }

    public string? Phone { get; set; }

    /// <summary>One of: none, person1_family, person1_friend, person1_family_friend,
    /// person2_family, person2_friend, person2_family_friend, both_friend.</summary>
    public string Relationship { get; set; } = "none";

    /// <summary>One of: definitely, maybe.</summary>
    public string InvitedStatus { get; set; } = "definitely";

    public bool HasPlusOne { get; set; }
    public string? PlusOneFirstName { get; set; }
    public string? PlusOneLastName { get; set; }
    public bool PlusOneNameUnknown { get; set; }

    public bool HasChild { get; set; }
    public string? ChildFirstName { get; set; }
    public string? ChildLastName { get; set; }
    public bool ChildNameUnknown { get; set; }

    public int SortOrder { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
