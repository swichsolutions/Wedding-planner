using System.ComponentModel.DataAnnotations;

namespace WeddingPlanner.Api.Dtos;

public record SeatingTableDto(int Id, string Name, string Shape, int SeatCount, double PositionX, double PositionY, double Rotation);

public class SeatingTableCreateDto
{
    [Required, MaxLength(120)] public string Name { get; set; } = string.Empty;
    [Required, MaxLength(20)] public string Shape { get; set; } = "round";
    [Range(1, 40)] public int SeatCount { get; set; }
    public double PositionX { get; set; }
    public double PositionY { get; set; }
    [Range(0, 360)] public double Rotation { get; set; }
}

public class SeatingTableUpdateDto : SeatingTableCreateDto
{
}

public record SeatAssignmentDto(int TableId, int SeatIndex, int GuestId, string AttendeeKind);

public class SeatAssignDto
{
    [Required] public int TableId { get; set; }
    [Required] public int SeatIndex { get; set; }
    [Required] public int GuestId { get; set; }
    [Required, MaxLength(20)] public string AttendeeKind { get; set; } = "primary";
}

public record SeatingObjectDto(int Id, string Type, double PositionX, double PositionY, double Width, double Height, double Rotation, string? Label);

public class SeatingObjectCreateDto
{
    [Required, MaxLength(30)] public string Type { get; set; } = string.Empty;
    public double PositionX { get; set; }
    public double PositionY { get; set; }
    [Range(10, 2000)] public double Width { get; set; }
    [Range(10, 2000)] public double Height { get; set; }
    [Range(0, 360)] public double Rotation { get; set; }
    [MaxLength(60)] public string? Label { get; set; }
}

public class SeatingObjectUpdateDto : SeatingObjectCreateDto
{
}

public record SeatingStateDto(
    IEnumerable<SeatingTableDto> Tables,
    IEnumerable<SeatAssignmentDto> Assignments,
    IEnumerable<SeatingObjectDto> Objects,
    /// <summary>The floor plan under the chart: the couple's own upload or their copy of the venue's.</summary>
    string? FloorPlanUrl,
    /// <summary>The venue the plan was copied from; null for the couple's own upload.</summary>
    int? FloorPlanVendorId,
    /// <summary>The couple's venue (chosen first, else shortlisted or saved) when it has a floor plan to offer.</summary>
    VenuePlanDto? VenuePlan);

public record VenuePlanDto(int VendorId, string Name, string FloorPlanUrl);

public class UseVenuePlanDto
{
    [Required] public int VendorId { get; set; }
}

/// <summary>Seat a guest's whole party at a table (free seats, in order), or unseat it (TableId null).</summary>
public class SeatGuestDto
{
    [Required] public int GuestId { get; set; }
    public int? TableId { get; set; }
}
