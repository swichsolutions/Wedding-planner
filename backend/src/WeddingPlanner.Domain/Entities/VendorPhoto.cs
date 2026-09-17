namespace WeddingPlanner.Domain.Entities;

/// <summary>
/// A portfolio image for a vendor. Real-wedding shots are prioritised over styled ones.
/// AltText is descriptive alt copy — an SEO requirement, not optional (see CLAUDE.md SEO).
/// </summary>
public class VendorPhoto
{
    public int Id { get; set; }
    public int VendorId { get; set; }
    public Vendor Vendor { get; set; } = null!;

    public string Url { get; set; } = string.Empty;

    /// <summary>Storage provider id (e.g. Cloudinary public id) used to delete the asset.</summary>
    public string? StorageId { get; set; }

    public string? AltText { get; set; }
    public int SortOrder { get; set; }
    public bool IsRealWedding { get; set; }
}
