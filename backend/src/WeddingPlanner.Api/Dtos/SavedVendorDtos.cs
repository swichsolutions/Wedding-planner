using System.ComponentModel.DataAnnotations;

namespace WeddingPlanner.Api.Dtos;

public class SaveVendorDto
{
    [Range(1, int.MaxValue)] public int VendorId { get; set; }
}
