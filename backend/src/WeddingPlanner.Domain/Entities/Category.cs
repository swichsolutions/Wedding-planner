namespace WeddingPlanner.Domain.Entities;

/// <summary>
/// A vendor category (sub-type) such as photographer, venue, florist. Bilingual names + URL slug.
/// The slug is used in SEO URLs, e.g. /fotografi/tbilisi/&lt;vendor-slug&gt;. Each category belongs
/// to one of the catalog's 8 groups (design-system/PROPOSALS.md P1).
/// </summary>
public class Category
{
    public int Id { get; set; }
    public string NameKa { get; set; } = string.Empty;
    public string NameEn { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;

    /// <summary>Catalog group: venues, photo, decor, music, cake, attire, beauty, other.</summary>
    public string GroupKey { get; set; } = string.Empty;

    public int SortOrder { get; set; }

    public ICollection<Vendor> Vendors { get; set; } = new List<Vendor>();
}
