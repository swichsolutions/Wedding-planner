using System.ComponentModel.DataAnnotations;

namespace WeddingPlanner.Api.Dtos;

/// <summary>
/// Everything the organizer overview shows (B7) in one read: a short summary per tool, and the
/// banner. Tasks come from the checklist the page already loads (it ticks them in place).
/// </summary>
public record OverviewDto(
    OverviewBudgetDto Budget,
    OverviewServicesDto Services,
    OverviewGuestsDto Guests,
    OverviewSeatingDto Seating,
    OverviewInvitationDto Invitation,
    OverviewDayDto Day,
    OverviewBannerDto Banner);

/// <summary>Planned = the lines' estimates, agreed = their agreed prices, left = agreed minus paid.</summary>
public record OverviewBudgetDto(
    decimal? Total,
    decimal Planned,
    decimal Agreed,
    decimal Paid,
    decimal Left,
    IReadOnlyList<OverviewPaymentDto> NextPayments);

/// <summary>A dated payment still to make; Left = what remains of the agreed price (or estimate).</summary>
public record OverviewPaymentDto(int Id, string Name, DateOnly Date, decimal Left);

public record OverviewServicesDto(int Saved, int Shortlist, int Chosen, IReadOnlyList<OverviewChosenDto> ChosenList);

public record OverviewChosenDto(string Name, string? CategorySlug);

/// <summary>People counts include plus-ones and children. Invitees = personal links (families and
/// guests invited alone); Replied = how many of them answered on the invitation.</summary>
public record OverviewGuestsDto(
    int Parties,
    int People,
    int Yes,
    int Pending,
    int No,
    int Dietary,
    int Invitees,
    int Replied,
    IReadOnlyList<OverviewReplyDto> Recent);

/// <summary>One party's latest answer: how many rows said yes / no, and their message.</summary>
public record OverviewReplyDto(string Name, int Yes, int No, string? Message, DateTimeOffset At);

/// <summary>ToSeat = people who haven't declined.</summary>
public record OverviewSeatingDto(int Tables, int Seats, int Seated, int ToSeat);

/// <summary>Status: none | draft | published.</summary>
public record OverviewInvitationDto(string Status, string? Slug, DateOnly? RsvpDeadline);

public record OverviewDayDto(int Items, IReadOnlyList<OverviewDayItemDto> First, string? LastTime);

public record OverviewDayItemDto(string? Time, string Activity);

/// <summary>The banner's layers: the chosen venue (name, its first photo), the palette, the marked photos.</summary>
public record OverviewBannerDto(
    string? VenueName,
    string? VenuePhotoUrl,
    string? PaletteKey,
    IReadOnlyList<PlanPhotoDto> Photos);

public class PaletteUpdateDto
{
    /// <summary>One of BannerRules.PaletteKeys; null clears the choice.</summary>
    [MaxLength(20)] public string? Key { get; set; }
}

// ---- marked photos ----

/// <summary>A marked photo with where it came from (a vendor profile or an inspiration idea).</summary>
public record PlanPhotoDto(
    int Id,
    string Url,
    string Kind,
    int? VendorPhotoId,
    int? ContentPhotoId,
    string? SourceName,
    string? SourceNameEn,
    string? SourcePath);

/// <summary>Exactly one of the two.</summary>
public class PlanPhotoMarkDto
{
    public int? VendorPhotoId { get; set; }
    public int? ContentPhotoId { get; set; }
}
