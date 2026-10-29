namespace WeddingPlanner.Domain.Entities;

/// <summary>
/// A photo the couple marked for their wedding (B7): décor, flowers, cake or tables from a vendor's
/// portfolio or an inspiration page. The overview banner lays the marked photos out; there is no
/// separate moodboard. Owned by the shared plan (<see cref="Couple"/>). The photo goes when its
/// source photo is deleted.
/// </summary>
public class PlanPhoto
{
    public int Id { get; set; }

    public int CoupleId { get; set; }

    /// <summary>decor | flowers | cake | tables, from the vendor's category or the idea's topic.</summary>
    public string Kind { get; set; } = string.Empty;

    /// <summary>Copied from the source photo, so the banner needs no joins.</summary>
    public string Url { get; set; } = string.Empty;

    /// <summary>Exactly one source: a vendor's portfolio photo or an inspiration page's photo.</summary>
    public int? VendorPhotoId { get; set; }
    public VendorPhoto? VendorPhoto { get; set; }

    public int? ContentPhotoId { get; set; }
    public ContentPhoto? ContentPhoto { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
