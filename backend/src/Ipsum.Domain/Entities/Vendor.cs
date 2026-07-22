namespace Ipsum.Domain.Entities;

/// <summary>
/// A wedding vendor profile — the core couple-facing entity. Photo-heavy, SEO-driven.
/// URL shape: /{category.Slug}/{CitySlug}/{Slug}.
/// </summary>
public class Vendor
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;

    /// <summary>URL-safe slug, unique within a category+city.</summary>
    public string Slug { get; set; } = string.Empty;

    public int CategoryId { get; set; }
    public Category Category { get; set; } = null!;

    /// <summary>Primary city, Georgian display name (e.g. "თბილისი").</summary>
    public string City { get; set; } = string.Empty;

    /// <summary>URL-safe city slug (e.g. "tbilisi").</summary>
    public string CitySlug { get; set; } = string.Empty;

    /// <summary>Free-text regions/areas served, beyond the primary city.</summary>
    public string? AreasServed { get; set; }

    public decimal? PriceMin { get; set; }

    /// <summary>Human-readable price range, e.g. "1000–3000 ₾".</summary>
    public string? PriceRange { get; set; }

    public string? Bio { get; set; }
    public string? Instagram { get; set; }
    public string? Facebook { get; set; }
    public string? Phone { get; set; }
    public string? MessageEmail { get; set; }

    /// <summary>Google Maps URL the vendor pastes (no API key needed to link out).</summary>
    public string? MapUrl { get; set; }

    /// <summary>Dormant monetization plumbing — paid placement switch (see CLAUDE.md §4).</summary>
    public bool IsFeatured { get; set; }

    /// <summary>Admin moderation gate. Only approved vendors are shown publicly.</summary>
    public bool IsApproved { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public ICollection<VendorPhoto> Photos { get; set; } = new List<VendorPhoto>();
    public ICollection<VendorStyleTag> StyleTags { get; set; } = new List<VendorStyleTag>();
    public ICollection<Message> Messages { get; set; } = new List<Message>();
    public ICollection<VendorStat> Stats { get; set; } = new List<VendorStat>();
}
