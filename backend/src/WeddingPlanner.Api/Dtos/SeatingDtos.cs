using System.ComponentModel.DataAnnotations;

namespace WeddingPlanner.Api.Dtos;

public record SeatingTableDto(int Id, string Name, string Shape, int SeatCount, double PositionX, double PositionY);

public class SeatingTableCreateDto
{
    [Required, MaxLength(120)] public string Name { get; set; } = string.Empty;
    [Required, MaxLength(20)] public string Shape { get; set; } = "round";
    [Range(1, 40)] public int SeatCount { get; set; }
    public double PositionX { get; set; }
    public double PositionY { get; set; }
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

public record SeatingObjectDto(int Id, string Type, double PositionX, double PositionY, double Width, double Height);

public class SeatingObjectCreateDto
{
    [Required, MaxLength(30)] public string Type { get; set; } = string.Empty;
    public double PositionX { get; set; }
    public double PositionY { get; set; }
    [Range(10, 2000)] public double Width { get; set; }
    [Range(10, 2000)] public double Height { get; set; }
}

public class SeatingObjectUpdateDto : SeatingObjectCreateDto
{
}

public record SeatingStateDto(
    IEnumerable<SeatingTableDto> Tables,
    IEnumerable<SeatAssignmentDto> Assignments,
    IEnumerable<SeatingObjectDto> Objects);
