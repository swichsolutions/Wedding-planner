using System.ComponentModel.DataAnnotations;

namespace WeddingPlanner.Api.Dtos;

/// <summary>Someone working on the plan (at most two).</summary>
public record PlanMemberDto(string? Name, string? Email, bool IsMe, bool IsPartner, DateTimeOffset JoinedAt);

/// <summary>The plan's open partner invitation (the link itself is only shown once, when made).</summary>
public record PlanInviteDto(string? Email, DateTimeOffset CreatedAt, DateTimeOffset ExpiresAt);

/// <summary>The shared plan: the couple's details, who's on it, and the open invitation.</summary>
public record PlanDto(
    string? FirstName,
    string? LastName,
    string? PartnerFirstName,
    string? PartnerLastName,
    DateOnly? WeddingDate,
    string? City,
    string? Region,
    string? PlanningStage,
    string? GuestCountRange,
    IReadOnlyList<string> NeededCategories,
    decimal? TotalBudget,
    /// <summary>The signed-in person is the plan's Partner* name (joined by invitation).</summary>
    bool IAmPartner,
    IReadOnlyList<PlanMemberDto> Members,
    PlanInviteDto? Invite,
    /// <summary>Room for a partner (one member so far).</summary>
    bool CanInvite,
    /// <summary>Mail is really delivered, so the invite form offers an email field.</summary>
    bool EmailInvites);

/// <summary>
/// The start form after sign-up and the settings page (guide §3, §6). Every field is optional:
/// null means "not known yet" and clears what was there.
/// </summary>
public class PlanUpdateDto
{
    [MaxLength(120)] public string? FirstName { get; set; }
    [MaxLength(120)] public string? LastName { get; set; }
    [MaxLength(120)] public string? PartnerFirstName { get; set; }
    [MaxLength(120)] public string? PartnerLastName { get; set; }
    public DateOnly? WeddingDate { get; set; }
    [MaxLength(120)] public string? City { get; set; }
    [MaxLength(40)] public string? Region { get; set; }
    [MaxLength(30)] public string? GuestCountRange { get; set; }
}

public class PlanInviteCreateDto
{
    /// <summary>Also email the link (only when mail is set up); blank = just the link.</summary>
    [EmailAddress, MaxLength(256)] public string? Email { get; set; }
    /// <summary>The inviter's language, for the email.</summary>
    [MaxLength(5)] public string? Lang { get; set; }
}

public record PlanInviteCreatedDto(string Link, DateTimeOffset ExpiresAt, bool Emailed);

/// <summary>What an invitation link leads to: ok, used, expired, full or invalid.</summary>
public record PlanInvitePreviewDto(string Status, string? Names);

public class PlanInviteAcceptDto
{
    /// <summary>The joiner confirmed leaving their own plan (it's deleted if nobody else is on it).</summary>
    public bool Replace { get; set; }
}
