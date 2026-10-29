namespace WeddingPlanner.Domain.Entities;

/// <summary>
/// A couple's personal wedding website (The Knot-style). One per couple account,
/// part of the shared plan like <see cref="ChecklistItem"/>. Published sites are public at
/// /w/{Slug}; the slug is assigned at first publish and never changes after.
/// </summary>
public class WeddingSite
{
    public int Id { get; set; }

    /// <summary>The plan it belongs to (<see cref="Couple"/>). One site per plan.</summary>
    public int CoupleId { get; set; }

    /// <summary>Public URL slug (e.g. "nino-giorgi-2026"); null until first publish.</summary>
    public string? Slug { get; set; }

    /// <summary>Design theme key (one of the catalog's template keys).</summary>
    public string TemplateKey { get; set; } = "glow";

    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? PartnerFirstName { get; set; }
    public string? PartnerLastName { get; set; }

    public DateOnly? WeddingDate { get; set; }

    /// <summary>Free-text wedding place — venue and/or city.</summary>
    public string? Place { get; set; }

    /// <summary>Greeting paragraph shown on the site; null = template default.</summary>
    public string? Message { get; set; }

    /// <summary>Custom text color ("#rrggbb"); null = the design's own ink.</summary>
    public string? InkColor { get; set; }

    /// <summary>Custom accent color ("#rrggbb"); null = the design's own accent.</summary>
    public string? AccentColor { get; set; }

    public string? PhotoUrl { get; set; }
    public string? PhotoStorageId { get; set; }

    /// <summary>
    /// Photo focal point in percent (0–100, 50/50 = center), chosen by the couple.
    /// Templates crop the photo to different aspect ratios; this point stays in frame.
    /// </summary>
    public int PhotoFocusX { get; set; } = 50;
    public int PhotoFocusY { get; set; } = 50;

    /// <summary>Start time "HH:mm", shown with the date.</summary>
    public string? StartTime { get; set; }

    /// <summary>Typeface for the names: null = the design's own, else classic | plain | capitals | modern.</summary>
    public string? FontKey { get; set; }

    // ---- places (B6): each shows when it has a name or an address ----
    public string? CeremonyName { get; set; }
    public string? CeremonyAddress { get; set; }
    /// <summary>"HH:mm".</summary>
    public string? CeremonyTime { get; set; }
    /// <summary>The couple's own map link; null = a search link built from the address.</summary>
    public string? CeremonyMapUrl { get; set; }

    public string? ReceptionName { get; set; }
    public string? ReceptionAddress { get; set; }
    public string? ReceptionTime { get; set; }
    public string? ReceptionMapUrl { get; set; }

    // ---- extra details (B6): null = not on the invitation ----
    public string? DressCode { get; set; }
    public string? Transport { get; set; }
    public string? Accommodation { get; set; }

    /// <summary>Short schedule for guests; empty = not shown.</summary>
    public List<WeddingSiteScheduleItem> Schedule { get; set; } = new();

    /// <summary>Extra photos below the details.</summary>
    public List<WeddingSitePhoto> Photos { get; set; } = new();

    // ---- RSVP (B6): guests answer through their family's personal link ----
    public bool RsvpEnabled { get; set; } = true;

    /// <summary>Last day to answer (inclusive, Tbilisi time); null = open until the couple turns it off.</summary>
    public DateOnly? RsvpDeadline { get; set; }

    public bool RsvpAskDiet { get; set; } = true;
    public bool RsvpAskMessage { get; set; } = true;

    /// <summary>One question of the couple's own, e.g. "Which song gets you dancing?"; null = none.</summary>
    public string? RsvpQuestion { get; set; }

    public bool IsPublished { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
