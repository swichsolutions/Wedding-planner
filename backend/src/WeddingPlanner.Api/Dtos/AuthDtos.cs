using System.ComponentModel.DataAnnotations;

namespace WeddingPlanner.Api.Dtos;

public class RegisterVendorDto
{
    [Required, EmailAddress] public string Email { get; set; } = string.Empty;
    [Required, MinLength(8)] public string Password { get; set; } = string.Empty;
    [Required, MaxLength(200)] public string VendorName { get; set; } = string.Empty;
    [Required] public string CategorySlug { get; set; } = string.Empty;
    [MaxLength(120)] public string? City { get; set; }
}

public class RegisterCoupleDto
{
    [Required, EmailAddress] public string Email { get; set; } = string.Empty;
    [Required, MinLength(8)] public string Password { get; set; } = string.Empty;

    // Optional details for the new plan. Sign-up asks for the account first and the details
    // afterwards (PUT /api/plan), so these are usually empty.
    [MaxLength(120)] public string? FirstName { get; set; }
    [MaxLength(120)] public string? LastName { get; set; }
    [MaxLength(120)] public string? PartnerFirstName { get; set; }
    [MaxLength(120)] public string? PartnerLastName { get; set; }
    public DateOnly? WeddingDate { get; set; }
    [MaxLength(60)] public string? PlanningStage { get; set; }
    [MaxLength(30)] public string? GuestCountRange { get; set; }
    public List<string>? NeededCategories { get; set; }
}

/// <summary>Start the plan over (PUT /api/plan/restart) — same shape as registration minus
/// credentials. Wipes and reseeds the checklist + budget.</summary>
public class CoupleRestartDto
{
    [MaxLength(120)] public string? FirstName { get; set; }
    [MaxLength(120)] public string? LastName { get; set; }
    [MaxLength(120)] public string? PartnerFirstName { get; set; }
    [MaxLength(120)] public string? PartnerLastName { get; set; }
    public DateOnly? WeddingDate { get; set; }
    [MaxLength(60)] public string? PlanningStage { get; set; }
    [MaxLength(30)] public string? GuestCountRange { get; set; }
    public List<string>? NeededCategories { get; set; }
}

public class LoginDto
{
    [Required, EmailAddress] public string Email { get; set; } = string.Empty;
    [Required] public string Password { get; set; } = string.Empty;
}

public class GoogleLoginDto
{
    /// <summary>The Google ID token (JWT credential) issued by Google Identity Services in the browser.</summary>
    [Required] public string Credential { get; set; } = string.Empty;
}

public class ForgotPasswordDto
{
    [Required, EmailAddress, MaxLength(256)] public string Email { get; set; } = string.Empty;

    /// <summary>Language of the email: "ka" (default) or "en".</summary>
    [MaxLength(5)] public string? Lang { get; set; }
}

public class ResetPasswordDto
{
    [Required, MaxLength(64)] public string UserId { get; set; } = string.Empty;

    /// <summary>The token from the emailed link, still base64url-encoded.</summary>
    [Required, MaxLength(2048)] public string Token { get; set; } = string.Empty;

    [Required, MinLength(8)] public string NewPassword { get; set; } = string.Empty;
}

/// <summary>IsNew: a first Google sign-in just created the account (the client shows the start form).</summary>
public record AuthResponseDto(string Token, string Email, string[] Roles, int? VendorId, bool IsNew = false);
