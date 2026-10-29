namespace WeddingPlanner.Domain.Entities;

/// <summary>A non-seatable venue item placed on the seating chart canvas — dance
/// floor, cake table, gift table, bar, DJ booth, stage, entrance, etc. Owned by the
/// shared plan (<see cref="Couple"/>), like <see cref="SeatingTable"/>. Free-form canvas
/// position and size, same convention as <see cref="SeatingTable"/>.</summary>
public class SeatingObject
{
    public int Id { get; set; }

    public int CoupleId { get; set; }

    /// <summary>One of <see cref="Api.Controllers.SeatingController"/>'s allowed object types
    /// (e.g. "dance_floor", "cake_table", "bar", "entrance").</summary>
    public string Type { get; set; } = string.Empty;

    public double PositionX { get; set; }

    public double PositionY { get; set; }

    public double Width { get; set; }

    public double Height { get; set; }

    /// <summary>Clockwise turn in degrees (0–359), about the item's centre.</summary>
    public double Rotation { get; set; }

    /// <summary>The couple's own name for it ("ცოცხალი მუსიკა"); the type's name when empty.</summary>
    public string? Label { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
