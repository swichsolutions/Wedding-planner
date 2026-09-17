using WeddingPlanner.Api.Dtos;
using WeddingPlanner.Infrastructure.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace WeddingPlanner.Api.Controllers;

/// <summary>
/// Self-serve account settings for any signed-in user (couple, vendor, or admin): view the
/// account and change/set the sign-in password. Distinct from the vendor dashboard, which
/// edits the public business listing rather than the user account.
/// </summary>
[ApiController]
[Route("api/account")]
[Authorize]
public class AccountController : ControllerBase
{
    private readonly UserManager<AppUser> _users;

    public AccountController(UserManager<AppUser> users) => _users = users;

    [HttpGet("me")]
    public async Task<ActionResult<AccountDto>> GetMe()
    {
        var user = await _users.GetUserAsync(User);
        if (user is null) return Unauthorized();

        var roles = await _users.GetRolesAsync(user);
        var hasPassword = await _users.HasPasswordAsync(user);
        return Ok(new AccountDto(user.Email ?? string.Empty, user.DisplayName, roles.ToArray(), hasPassword));
    }

    /// <summary>
    /// Change the password (requires the current one) — or, for a passwordless account created
    /// via Google sign-in, set a password for the first time so the user can also sign in with
    /// email + password. Returns a short error code the client localizes.
    /// </summary>
    [HttpPost("password")]
    // ChangePasswordAsync verifies the current password without touching lockout —
    // throttle it so a session holder can't brute-force the current password.
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        var user = await _users.GetUserAsync(User);
        if (user is null) return Unauthorized();

        IdentityResult result;
        if (await _users.HasPasswordAsync(user))
        {
            if (string.IsNullOrEmpty(dto.CurrentPassword))
                return BadRequest(new { code = "current_required" });
            result = await _users.ChangePasswordAsync(user, dto.CurrentPassword, dto.NewPassword);
        }
        else
        {
            // Passwordless (external/Google) account establishing a local password for the first time.
            result = await _users.AddPasswordAsync(user, dto.NewPassword);
        }

        if (result.Succeeded) return NoContent();

        // Wrong current password is the common, user-actionable case → give it a distinct code.
        var code = result.Errors.Any(e => e.Code == "PasswordMismatch")
            ? "current_incorrect"
            : "weak_password";
        return BadRequest(new { code, errors = result.Errors.Select(e => e.Description) });
    }
}
