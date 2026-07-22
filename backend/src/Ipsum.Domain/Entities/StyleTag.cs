namespace Ipsum.Domain.Entities;

/// <summary>Aesthetic style tag (rustic, modern, traditional, minimalist, ...).</summary>
public class StyleTag
{
    public int Id { get; set; }
    public string NameKa { get; set; } = string.Empty;
    public string NameEn { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;

    public ICollection<VendorStyleTag> Vendors { get; set; } = new List<VendorStyleTag>();
}
