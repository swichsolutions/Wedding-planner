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

    // Onboarding profile (all optional — steps are skippable, credentials come last).
    [MaxLength(120)] public string? FirstName { get; set; }
    [MaxLength(120)] public string? LastName { get; set; }
    [MaxLength(120)] public string? PartnerFirstName { get; set; }
    [MaxLength(120)] public string? PartnerLastName { get; set; }
    public DateOnly? WeddingDate { get; set; }
    [MaxLength(60)] public string? PlanningStage { get; set; }
    [MaxLength(30)] public string? GuestCountRange { get; set; }
    public List<string>? NeededCategories { get; set; }
}

public record CoupleProfileDto(
    string? FirstName,
    string? LastName,
    string? PartnerFirstName,
    string? PartnerLastName,
    DateOnly? WeddingDate,
    string? PlanningStage,
    string? GuestCountRange,
    IReadOnlyList<string> NeededCategories);

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

public record AuthResponseDto(string Token, string Email, string[] Roles, int? VendorId);
