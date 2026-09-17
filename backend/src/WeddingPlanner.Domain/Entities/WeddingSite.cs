namespace WeddingPlanner.Domain.Entities;

/// <summary>
/// A couple's personal wedding website (The Knot-style). One per couple account,
/// owned via UserId like <see cref="ChecklistItem"/>. Published sites are public at
/// /w/{Slug}; the slug is assigned at first publish and never changes after.
/// </summary>
public class WeddingSite
{
    public int Id { get; set; }

    /// <summary>Owning couple user's id (AppUser.Id). One site per couple.</summary>
    public string UserId { get; set; } = string.Empty;

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

    public bool IsPublished { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
