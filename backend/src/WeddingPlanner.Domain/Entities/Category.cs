namespace WeddingPlanner.Domain.Entities;

/// <summary>
/// A vendor category (photographer, venue, florist, ...). Bilingual names + URL slug.
/// The slug is used in SEO URLs, e.g. /fotografi/tbilisi/&lt;vendor-slug&gt;.
/// </summary>
public class Category
{
    public int Id { get; set; }
    public string NameKa { get; set; } = string.Empty;
    public string NameEn { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public int SortOrder { get; set; }

    public ICollection<Vendor> Vendors { get; set; } = new List<Vendor>();
}
