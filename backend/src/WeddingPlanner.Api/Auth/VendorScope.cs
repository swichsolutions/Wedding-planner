using System.Security.Claims;
using Microsoft.AspNetCore.Routing;

namespace WeddingPlanner.Api.Auth;

/// <summary>
/// Which vendor record a profile or photo request works on. A vendor gets their own (the
/// "vendorId" claim). On the admin routes (/api/admin/vendors/{vendorId}/…) an admin gets the
/// vendor in the URL, so profiles the platform added (A3), which have no owner account yet,
/// can be finished with the same editor. Anyone else gets null (→ 403).
/// </summary>
public static class VendorScope
{
    public static int? Resolve(ClaimsPrincipal user, RouteData route)
    {
        if (route.Values.TryGetValue("vendorId", out var raw))
            return user.IsInRole(Roles.Admin) && int.TryParse(raw?.ToString(), out var id) ? id : null;
        return int.TryParse(user.FindFirst("vendorId")?.Value, out var own) ? own : null;
    }
}
