using System.ComponentModel.DataAnnotations;

namespace WeddingPlanner.Api.Dtos;

/// <summary>One vendor added by hand from the admin panel (unapproved, no owner); bulk goes through the import.</summary>
public class AdminCreateVendorDto
{
    [Required, MaxLength(200)] public string Name { get; set; } = string.Empty;
    [Required] public string CategorySlug { get; set; } = string.Empty;
    [MaxLength(120)] public string? City { get; set; }
    [MaxLength(40)] public string? Phone { get; set; }
    [MaxLength(120)] public string? Instagram { get; set; }
}
