namespace Ipsum.Domain.Entities;

/// <summary>Many-to-many join between <see cref="Vendor"/> and <see cref="StyleTag"/>.</summary>
public class VendorStyleTag
{
    public int VendorId { get; set; }
    public Vendor Vendor { get; set; } = null!;

    public int StyleTagId { get; set; }
    public StyleTag StyleTag { get; set; } = null!;
}
