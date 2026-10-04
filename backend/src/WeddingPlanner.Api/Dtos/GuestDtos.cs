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
    int SortOrder);

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
}

public class GuestUpdateDto : GuestCreateDto
{
}
