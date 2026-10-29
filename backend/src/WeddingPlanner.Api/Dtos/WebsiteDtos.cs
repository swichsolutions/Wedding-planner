using System.ComponentModel.DataAnnotations;
using WeddingPlanner.Api.Planning;

namespace WeddingPlanner.Api.Dtos;

/// <summary>One line of the invitation's short schedule.</summary>
public record SiteScheduleItemDto(string? Time, string Text);

/// <summary>An extra photo on the invitation.</summary>
public record SitePhotoDto(int Id, string Url);

public record WeddingSiteDto(
    string TemplateKey,
    string? FirstName,
    string? LastName,
    string? PartnerFirstName,
    string? PartnerLastName,
    DateOnly? WeddingDate,
    string? Place,
    string? Message,
    string? InkColor,
    string? AccentColor,
    string? PhotoUrl,
    int PhotoFocusX,
    int PhotoFocusY,
    bool IsPublished,
    string? Slug,
    string? StartTime,
    string? FontKey,
    string? CeremonyName,
    string? CeremonyAddress,
    string? CeremonyTime,
    string? CeremonyMapUrl,
    string? ReceptionName,
    string? ReceptionAddress,
    string? ReceptionTime,
    string? ReceptionMapUrl,
    string? DressCode,
    string? Transport,
    string? Accommodation,
    IReadOnlyList<SiteScheduleItemDto> Schedule,
    IReadOnlyList<SitePhotoDto> Photos,
    bool RsvpEnabled,
    DateOnly? RsvpDeadline,
    bool RsvpAskDiet,
    bool RsvpAskMessage,
    string? RsvpQuestion);

public class SiteScheduleItemInDto
{
    [RegularExpression(InviteRules.TimePattern)] public string? Time { get; set; }
    /// <summary>Empty lines are dropped.</summary>
    [MaxLength(120)] public string? Text { get; set; }
}

/// <summary>Full editable state — the API upserts the couple's single site with this. Text fields
/// are replaced as sent (null clears them); the lists and switches marked "null = keep" stay as
/// they are when left out.</summary>
public class WeddingSiteUpdateDto
{
    [Required, MaxLength(40)] public string TemplateKey { get; set; } = string.Empty;
    [MaxLength(120)] public string? FirstName { get; set; }
    [MaxLength(120)] public string? LastName { get; set; }
    [MaxLength(120)] public string? PartnerFirstName { get; set; }
    [MaxLength(120)] public string? PartnerLastName { get; set; }
    public DateOnly? WeddingDate { get; set; }
    [MaxLength(200)] public string? Place { get; set; }
    [MaxLength(2000)] public string? Message { get; set; }
    [RegularExpression("^#[0-9a-fA-F]{6}$")] public string? InkColor { get; set; }
    [RegularExpression("^#[0-9a-fA-F]{6}$")] public string? AccentColor { get; set; }

    /// <summary>Photo focal point in percent; null = keep the stored value.</summary>
    [Range(0, 100)] public int? PhotoFocusX { get; set; }
    [Range(0, 100)] public int? PhotoFocusY { get; set; }

    [RegularExpression(InviteRules.TimePattern)] public string? StartTime { get; set; }
    [MaxLength(20)] public string? FontKey { get; set; }

    [MaxLength(200)] public string? CeremonyName { get; set; }
    [MaxLength(300)] public string? CeremonyAddress { get; set; }
    [RegularExpression(InviteRules.TimePattern)] public string? CeremonyTime { get; set; }
    [MaxLength(500)] public string? CeremonyMapUrl { get; set; }
    [MaxLength(200)] public string? ReceptionName { get; set; }
    [MaxLength(300)] public string? ReceptionAddress { get; set; }
    [RegularExpression(InviteRules.TimePattern)] public string? ReceptionTime { get; set; }
    [MaxLength(500)] public string? ReceptionMapUrl { get; set; }

    [MaxLength(500)] public string? DressCode { get; set; }
    [MaxLength(500)] public string? Transport { get; set; }
    [MaxLength(500)] public string? Accommodation { get; set; }

    /// <summary>The whole short schedule, in order; null = keep.</summary>
    [MaxLength(InviteRules.MaxSchedule)] public List<SiteScheduleItemInDto>? Schedule { get; set; }

    /// <summary>null = keep.</summary>
    public bool? RsvpEnabled { get; set; }
    public DateOnly? RsvpDeadline { get; set; }
    /// <summary>null = keep.</summary>
    public bool? RsvpAskDiet { get; set; }
    /// <summary>null = keep.</summary>
    public bool? RsvpAskMessage { get; set; }
    [MaxLength(200)] public string? RsvpQuestion { get; set; }
}

/// <summary>What a published site exposes publicly — no owner/account information, no guest list.</summary>
public record PublicSiteDto(
    string TemplateKey,
    string? FirstName,
    string? PartnerFirstName,
    DateOnly? WeddingDate,
    string? Place,
    string? Message,
    string? InkColor,
    string? AccentColor,
    string? PhotoUrl,
    int PhotoFocusX,
    int PhotoFocusY,
    string? StartTime,
    string? FontKey,
    string? CeremonyName,
    string? CeremonyAddress,
    string? CeremonyTime,
    string? CeremonyMapUrl,
    string? ReceptionName,
    string? ReceptionAddress,
    string? ReceptionTime,
    string? ReceptionMapUrl,
    string? DressCode,
    string? Transport,
    string? Accommodation,
    IReadOnlyList<SiteScheduleItemDto> Schedule,
    IReadOnlyList<SitePhotoDto> Photos,
    bool RsvpEnabled,
    DateOnly? RsvpDeadline,
    bool RsvpOpen);

/// <summary>One row of the guest-facing "find a couple's website" search.</summary>
public record SiteSearchResultDto(
    string? FirstName,
    string? LastName,
    string? PartnerFirstName,
    string? PartnerLastName,
    DateOnly WeddingDate,
    string? Place,
    string Slug);

// ---- personal links and RSVP (B6) ----

/// <summary>Who one personal link is for: a family (D9) or a guest invited on their own.</summary>
public record InviteePartyDto(
    string Kind,
    int Id,
    string Name,
    int People,
    string Code,
    int Yes,
    int No,
    int Pending,
    DateTimeOffset? RsvpAt);

/// <summary>One guest row of a party as its RSVP form shows it: the guest with their plus-one and
/// child (B5's party), answered together.</summary>
public record RsvpGuestDto(
    int Id,
    string Name,
    bool HasPlusOne,
    string? PlusOneName,
    bool HasChild,
    string? ChildName,
    string Attendance,
    string? DietaryNeeds);

/// <summary>What a personal link shows: only this party's names and answers.</summary>
public record RsvpPartyDto(
    string? FamilyName,
    IReadOnlyList<RsvpGuestDto> Guests,
    DateTimeOffset? RespondedAt,
    string? Message,
    string? Answer,
    bool Enabled,
    bool Open,
    DateOnly? Deadline,
    bool AskDiet,
    bool AskMessage,
    string? Question);

public class RsvpGuestAnswerDto
{
    public int Id { get; set; }
    /// <summary>yes | no.</summary>
    [Required, MaxLength(3)] public string Attendance { get; set; } = string.Empty;
    [MaxLength(200)] public string? DietaryNeeds { get; set; }
    /// <summary>The plus-one's name, when the couple didn't know it.</summary>
    [MaxLength(120)] public string? PlusOneName { get; set; }
}

public class RsvpSubmitDto
{
    [Required, MaxLength(50)] public List<RsvpGuestAnswerDto> Guests { get; set; } = new();
    [MaxLength(1000)] public string? Message { get; set; }
    [MaxLength(500)] public string? Answer { get; set; }
}
