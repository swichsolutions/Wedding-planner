using System.ComponentModel.DataAnnotations;

namespace WeddingPlanner.Api.Dtos;

public record GuestDto(
    int Id,
    string FirstName,
    string? LastName,
    string? Email,
    string? Phone,
    string Relationship,
    string InvitedStatus,
    bool HasPlusOne,
    string? PlusOneFirstName,
    string? PlusOneLastName,
    bool PlusOneNameUnknown,
    bool HasChild,
    string? ChildFirstName,
    string? ChildLastName,
    bool ChildNameUnknown,
    int SortOrder,
    string Attendance,
    string? DietaryNeeds,
    int? FamilyId,
    DateTimeOffset? RsvpAt,
    string? RsvpMessage,
    string? RsvpAnswer);

/// <summary>A family on the guest list (D9), with its last answer on the invitation (B6).</summary>
public record GuestFamilyDto(int Id, string Name, DateTimeOffset? RsvpAt, string? RsvpMessage, string? RsvpAnswer);

public class GuestFamilyUpsertDto
{
    [Required, MaxLength(120)] public string Name { get; set; } = string.Empty;
}

/// <summary>Put several guests into a family (or take them out of one: FamilyId null).</summary>
public class GuestFamilyAssignDto
{
    [Required, MaxLength(500)] public List<int> GuestIds { get; set; } = new();
    public int? FamilyId { get; set; }
}

public class GuestCreateDto
{
    [Required, MaxLength(120)] public string FirstName { get; set; } = string.Empty;
    [MaxLength(120)] public string? LastName { get; set; }
    [MaxLength(256), EmailAddress] public string? Email { get; set; }
    [MaxLength(40)] public string? Phone { get; set; }
    [MaxLength(40)] public string? Relationship { get; set; }
    [MaxLength(20)] public string? InvitedStatus { get; set; }

    public bool HasPlusOne { get; set; }
    [MaxLength(120)] public string? PlusOneFirstName { get; set; }
    [MaxLength(120)] public string? PlusOneLastName { get; set; }
    public bool PlusOneNameUnknown { get; set; }

    public bool HasChild { get; set; }
    [MaxLength(120)] public string? ChildFirstName { get; set; }
    [MaxLength(120)] public string? ChildLastName { get; set; }
    public bool ChildNameUnknown { get; set; }

    /// <summary>pending (default), yes, no.</summary>
    [MaxLength(10)] public string? Attendance { get; set; }
    [MaxLength(200)] public string? DietaryNeeds { get; set; }
    public int? FamilyId { get; set; }
}

public class GuestUpdateDto : GuestCreateDto
{
}
