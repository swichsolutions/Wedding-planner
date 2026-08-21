namespace Ipsum.Domain.Entities;

/// <summary>
/// A couple's public review of a vendor: 1–5 star rating + optional text. One review
/// per couple per vendor (resubmitting updates it). Aggregates (average + count)
/// surface on vendor cards and profiles; the text is real UGC — SEO substance.
/// </summary>
public class Review
{
    public int Id { get; set; }

    public int VendorId { get; set; }
    public Vendor Vendor { get; set; } = null!;

    /// <summary>Reviewing couple's AppUser id.</summary>
    public string UserId { get; set; } = string.Empty;

    /// <summary>Public display name captured at submit time (e.g. "ნინო გ.").</summary>
    public string AuthorName { get; set; } = string.Empty;

    /// <summary>1–5 stars (validated at the API boundary).</summary>
    public int Rating { get; set; }

    public string? Body { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }
}
