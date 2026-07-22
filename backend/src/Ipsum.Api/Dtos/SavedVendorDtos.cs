using System.ComponentModel.DataAnnotations;

namespace Ipsum.Api.Dtos;

public class SaveVendorDto
{
    [Range(1, int.MaxValue)] public int VendorId { get; set; }
}
