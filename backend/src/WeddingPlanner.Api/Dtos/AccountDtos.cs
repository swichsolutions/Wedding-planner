using System.ComponentModel.DataAnnotations;

namespace WeddingPlanner.Api.Dtos;

/// <summary>Account overview for the signed-in user (any role). HasPassword is false for
/// external-only accounts created via Google sign-in (no local password set yet).</summary>
public record AccountDto(string Email, string? DisplayName, string[] Roles, bool HasPassword, bool NewsOptIn);

/// <summary>The account page's "news by e-mail" switch.</summary>
public class NewsOptInDto
{
    public bool OptIn { get; set; }
}

public class ChangePasswordDto
{
    // Optional: not needed when the account has no local password yet (Google sign-in →
    // setting a password for the first time). Required by the server when one already exists.
    public string? CurrentPassword { get; set; }

    [Required, MinLength(8)]
    public string NewPassword { get; set; } = string.Empty;
}

/// <summary>One address on the admin's list for a mailing: who agreed to news by e-mail, and when.</summary>
public record NewsEmailDto(string Email, string? Name, DateTimeOffset AgreedAt);
