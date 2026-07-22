using System.ComponentModel.DataAnnotations;

namespace Ipsum.Api.Dtos;

/// <summary>Account overview for the signed-in user (any role). HasPassword is false for
/// external-only accounts created via Google sign-in (no local password set yet).</summary>
public record AccountDto(string Email, string? DisplayName, string[] Roles, bool HasPassword);

public class ChangePasswordDto
{
    // Optional: not needed when the account has no local password yet (Google sign-in →
    // setting a password for the first time). Required by the server when one already exists.
    public string? CurrentPassword { get; set; }

    [Required, MinLength(8)]
    public string NewPassword { get; set; } = string.Empty;
}
