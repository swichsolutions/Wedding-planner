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

    /// <summary>
    /// When the user agreed to get news and offers by e-mail (the optional box at sign-up, or the
    /// switch on the account page); null while they have not, or after they switched it off.
    /// Marketing mail goes only to accounts with a value here. Service mail does not look at it.
    /// </summary>
    public DateTimeOffset? NewsConsentAt { get; set; }
}
