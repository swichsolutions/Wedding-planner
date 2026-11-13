namespace WeddingPlanner.Domain.Entities;

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

    /// <summary>Legacy free-text areas (no longer edited; superseded by Region + ServedRegions).</summary>
    public string? AreasServed { get; set; }

    /// <summary>Region of the primary city/village (key, e.g. "kakheti"; PROPOSALS.md P4).</summary>
    public string? Region { get; set; }

    /// <summary>Other regions the vendor works in (service vendors; venues leave it empty).</summary>
    public List<string> ServedRegions { get; set; } = new();

    /// <summary>Other categories in the same group the vendor also offers (category slugs).</summary>
    public List<string> AlsoOffers { get; set; } = new();

    public decimal? PriceMin { get; set; }

    /// <summary>What the starting price is for: event, guest, hour, kg, item (null = the group's default).</summary>
    public string? PriceUnit { get; set; }

    /// <summary>Human-readable price range, e.g. "1000–3000 ₾".</summary>
    public string? PriceRange { get; set; }

    /// <summary>Style keys (PROPOSALS.md P3), for photo/video and decor/flowers.</summary>
    public List<string> Styles { get; set; } = new();

    /// <summary>Group-specific feature keys (PROPOSALS.md P2), e.g. parking, drone, delivery, rental.</summary>
    public List<string> Features { get; set; } = new();

    // ---- venues only ----
    public int? CapacityMin { get; set; }
    public int? CapacityMax { get; set; }
    /// <summary>indoor, outdoor or both.</summary>
    public string? Setting { get; set; }
    /// <summary>restaurant, hall, openAir, winery or hotel.</summary>
    public string? VenueType { get; set; }
    /// <summary>The venue's floor plan as an image (a PDF is rendered to an image in the browser
    /// before upload; BUILD-PLAN B5). Shown on the profile; couples' seating charts take a copy.</summary>
    public string? FloorPlanUrl { get; set; }
    public string? FloorPlanStorageId { get; set; }

    // ---- terms (information only: payments stay between couple and vendor, CLAUDE.md §4) ----
    public string? DepositTerms { get; set; }
    public string? CancellationTerms { get; set; }
    /// <summary>Working outside the base city: included, extra or none.</summary>
    public string? TravelPolicy { get; set; }
    public string? BookingLeadTime { get; set; }

    public string? Bio { get; set; }
    public string? Instagram { get; set; }
    public string? Facebook { get; set; }
    public string? Phone { get; set; }

    /// <summary>WhatsApp number, normalized to bare digits with country code (e.g. "995599123456").</summary>
    public string? Whatsapp { get; set; }

    public string? MessageEmail { get; set; }

    /// <summary>Google Maps URL the vendor pastes (no API key needed to link out).</summary>
    public string? MapUrl { get; set; }

    // ---- permission, for profiles the platform builds for a vendor ----
    /// <summary>Who allowed us to use the vendor's photos and information.</summary>
    public string? ConsentBy { get; set; }
    public DateOnly? ConsentOn { get; set; }
    /// <summary>How it was given, e.g. "Instagram შეტყობინება".</summary>
    public string? ConsentMethod { get; set; }

    /// <summary>Dormant monetization plumbing — paid placement switch (see CLAUDE.md §4).</summary>
    public bool IsFeatured { get; set; }

    /// <summary>Admin moderation gate. Only approved vendors are shown publicly.</summary>
    public bool IsApproved { get; set; }

    /// <summary>
    /// One-time code for taking over a profile an admin made (SHA-256 of the normalized code, never
    /// the code itself). The admin sends the code to the vendor; whoever registers with it owns the
    /// profile at once. Cleared when used or replaced. See ClaimCodes in the API.
    /// </summary>
    public string? ClaimCodeHash { get; set; }

    /// <summary>The code stops working after this; null when there is no code.</summary>
    public DateTimeOffset? ClaimCodeExpiresAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public ICollection<VendorPhoto> Photos { get; set; } = new List<VendorPhoto>();
    public ICollection<VendorPackage> Packages { get; set; } = new List<VendorPackage>();
    public ICollection<Message> Messages { get; set; } = new List<Message>();
    public ICollection<VendorStat> Stats { get; set; } = new List<VendorStat>();
    public ICollection<Review> Reviews { get; set; } = new List<Review>();
}
