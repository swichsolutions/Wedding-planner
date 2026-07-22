using System.ComponentModel.DataAnnotations;

namespace Ipsum.Api.Dtos;

public class CreateMessageDto
{
    [Required]
    public int VendorId { get; set; }

    [MaxLength(200)]
    public string? SenderName { get; set; }

    [EmailAddress]
    [MaxLength(256)]
    public string? SenderEmail { get; set; }

    [MaxLength(40)]
    public string? SenderPhone { get; set; }

    [Required]
    [MinLength(2)]
    public string Body { get; set; } = string.Empty;
}
