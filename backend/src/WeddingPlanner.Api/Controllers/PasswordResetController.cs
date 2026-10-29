using System.Text;
using WeddingPlanner.Api.Auth;
using WeddingPlanner.Api.Dtos;
using WeddingPlanner.Api.Email;
using WeddingPlanner.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Caching.Memory;

namespace WeddingPlanner.Api.Controllers;

/// <summary>
/// "Forgot password": email a one-time link, then set a new password from it. The link carries
/// the user id and an Identity reset token; the token dies after <see cref="PasswordResetEmail.LinkLifetime"/>,
/// after one use, and whenever the password changes (it is bound to the security stamp).
/// </summary>
[ApiController]
[Route("api/auth")]
public class PasswordResetController : ControllerBase
{
    /// <summary>At most one reset mail per account per window.</summary>
    private static readonly TimeSpan ResendCooldown = TimeSpan.FromMinutes(1);

    private readonly UserManager<AppUser> _users;
    private readonly TokenService _tokens;
    private readonly EmailOutbox _outbox;
    private readonly IMemoryCache _cache;
    private readonly IConfiguration _config;
    private readonly ILogger<PasswordResetController> _logger;

    public PasswordResetController(
        UserManager<AppUser> users,
        TokenService tokens,
        EmailOutbox outbox,
        IMemoryCache cache,
        IConfiguration config,
        ILogger<PasswordResetController> logger)
    {
        _users = users;
        _tokens = tokens;
        _outbox = outbox;
        _cache = cache;
        _config = config;
        _logger = logger;
    }

    /// <summary>Always 202, whether or not the email has an account — it must not reveal which do.</summary>
    [HttpPost("forgot-password")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordDto dto)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var user = await _users.FindByEmailAsync(dto.Email.Trim());
        if (user?.Email is null)
            return Accepted();

        // The per-IP "auth" limit doesn't stop someone rotating IPs to flood one inbox.
        var cooldownKey = $"pwreset:{user.Id}";
        if (_cache.TryGetValue(cooldownKey, out _))
            return Accepted();
        _cache.Set(cooldownKey, true, ResendCooldown);

        var token = await _users.GeneratePasswordResetTokenAsync(user);
        var link = $"{FrontendOrigin()}/reset-password" +
                   $"?uid={Uri.EscapeDataString(user.Id)}" +
                   $"&token={WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token))}";

        var brand = SiteLinks.Brand(_config);
        if (!_outbox.TryEnqueue(PasswordResetEmail.Build(user.Email, link, dto.Lang, brand)))
            _logger.LogError("Email queue full — a password-reset mail was dropped.");

        return Accepted();
    }

    /// <summary>Sets the new password and signs the user in (same response as login).</summary>
    [HttpPost("reset-password")]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<AuthResponseDto>> ResetPassword([FromBody] ResetPasswordDto dto)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var invalid = BadRequest(new { code = "invalid_token" });

        string token;
        try
        {
            token = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(dto.Token));
        }
        catch (FormatException)
        {
            return invalid;
        }

        var user = await _users.FindByIdAsync(dto.UserId);
        if (user is null)
            return invalid;

        // Identity checks the token before the password rules, so a weak password on a
        // good link leaves the link usable for another try.
        var result = await _users.ResetPasswordAsync(user, token, dto.NewPassword);
        if (!result.Succeeded)
        {
            if (result.Errors.Any(e => e.Code == "InvalidToken"))
                return invalid;
            return BadRequest(new { code = "weak_password", errors = result.Errors.Select(e => e.Description) });
        }

        // Owning the inbox is proof enough: lift any brute-force lockout so the new password works now.
        await _users.SetLockoutEndDateAsync(user, null);
        await _users.ResetAccessFailedCountAsync(user);

        var roles = await _users.GetRolesAsync(user);
        return Ok(new AuthResponseDto(_tokens.Create(user, roles), user.Email!, roles.ToArray(), user.VendorId));
    }

    private string FrontendOrigin() => SiteLinks.FrontendOrigin(_config);
}
