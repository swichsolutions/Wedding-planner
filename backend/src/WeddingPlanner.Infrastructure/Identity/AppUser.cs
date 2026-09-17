using Microsoft.AspNetCore.Identity;

namespace WeddingPlanner.Infrastructure.Identity;

/// <summary>
/// Application user. Roles: Couple, Vendor, Admin. Vendor-role users are linked to the
/// Vendor record they manage via <see cref="VendorId"/>.
/// </summary>
public class AppUser : IdentityUser
{
    public string? DisplayName { get; set; }
    public int? VendorId { get; set; }
}
