using System.ComponentModel.DataAnnotations;

namespace WeddingPlanner.Api.Dtos;

/// <summary>A visitor's message from the form on /contact. Mailed to the site inbox, not stored.</summary>
public class ContactInquiryDto
{
    [Required]
    [MinLength(2)]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    /// <summary>Required: the answer goes here (it becomes the mail's Reply-To).</summary>
    [Required]
    [EmailAddress]
    [MaxLength(256)]
    public string Email { get; set; } = string.Empty;

    [MaxLength(40)]
    public string? Phone { get; set; }

    [Required]
    [MinLength(5)]
    [MaxLength(4000)]
    public string Message { get; set; } = string.Empty;

    /// <summary>
    /// Honeypot: a field people never see and so never fill. Anything in it means a bot; the
    /// request is answered as if it were sent, and nothing is mailed.
    /// </summary>
    [MaxLength(200)]
    public string? Website { get; set; }
}
