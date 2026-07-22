using Ipsum.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;

namespace Ipsum.Api.Auth;

/// <summary>Seeds the role set and a dev admin user. Dev-only.</summary>
public static class IdentitySeeder
{
    public static async Task SeedAsync(
        UserManager<AppUser> users,
        RoleManager<IdentityRole> roles,
        IConfiguration config)
    {
        foreach (var role in Roles.All)
        {
            if (!await roles.RoleExistsAsync(role))
                await roles.CreateAsync(new IdentityRole(role));
        }

        var adminEmail = config["Seed:AdminEmail"] ?? "admin@ipsum.ge";
        var adminPassword = config["Seed:AdminPassword"] ?? "Admin!2026_dev";

        if (await users.FindByEmailAsync(adminEmail) is null)
        {
            var admin = new AppUser
            {
                UserName = adminEmail,
                Email = adminEmail,
                DisplayName = "Admin",
                EmailConfirmed = true,
            };
            var created = await users.CreateAsync(admin, adminPassword);
            if (created.Succeeded)
                await users.AddToRoleAsync(admin, Roles.Admin);
        }
    }
}
