namespace WeddingPlanner.Domain.Entities;

/// <summary>One guest (party) on a couple's guest list. Owned by the AppUser (couple)
/// shared plan (<see cref="Couple"/>), like <see cref="ChecklistItem"/>. A row can
/// also carry an optional plus-one and/or child travelling with the same guest,
/// rather than modelling them as separate linked guest rows.</summary>
public class Guest
{
    public int Id { get; set; }

    public int CoupleId { get; set; }

    public string FirstName { get; set; } = string.Empty;

    public string? LastName { get; set; }

    public string? Email { get; set; }

    public string? Phone { get; set; }

    /// <summary>One of: none, person1_family, person1_friend, person1_family_friend,
    /// person2_family, person2_friend, person2_family_friend, both_friend.</summary>
    public string Relationship { get; set; } = "none";

    /// <summary>One of: definitely, maybe.</summary>
    public string InvitedStatus { get; set; } = "definitely";

    /// <summary>Whether the party is coming (B5): pending, yes, no. Set by the couple, or by the
    /// party's RSVP on the invitation (B6). "no" frees their seats.</summary>
    public string Attendance { get; set; } = "pending";

    /// <summary>Dietary needs for the party, as written (vegetarian, no nuts, …).</summary>
    public string? DietaryNeeds { get; set; }

    /// <summary>The family this guest is invited with (D9), if any.</summary>
    public int? FamilyId { get; set; }
    public GuestFamily? Family { get; set; }

    public bool HasPlusOne { get; set; }
    public string? PlusOneFirstName { get; set; }
    public string? PlusOneLastName { get; set; }
    public bool PlusOneNameUnknown { get; set; }

    public bool HasChild { get; set; }
    public string? ChildFirstName { get; set; }
    public string? ChildLastName { get; set; }
    public bool ChildNameUnknown { get; set; }

    /// <summary>Personal invitation link code (B6), for a guest invited without a family. A guest who
    /// joins a family later opens the family's answers with it.</summary>
    public string? InviteCode { get; set; }

    /// <summary>When the party last answered through the invitation; null = never.</summary>
    public DateTimeOffset? RsvpAt { get; set; }

    /// <summary>The message to the couple, when this guest answered on their own link.</summary>
    public string? RsvpMessage { get; set; }

    /// <summary>The answer to the couple's own question, when this guest answered on their own link.</summary>
    public string? RsvpAnswer { get; set; }

    public int SortOrder { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
