namespace WeddingPlanner.Domain.Entities;

/// <summary>One table on the couple's seating chart. Owned by the AppUser (couple)
/// via UserId, like <see cref="Guest"/>. Position is free-form canvas coordinates
/// (px, relative to the canvas origin) so couples can lay the chart out to mirror
/// their actual venue.</summary>
public class SeatingTable
{
    public int Id { get; set; }

    public string UserId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    /// <summary>"round", "rectangular" (seats on two long sides), "one_sided" (seats on
    /// one edge only, e.g. a head table), or "four_sided" (seats on all four sides).</summary>
    public string Shape { get; set; } = "round";

    public int SeatCount { get; set; }

    public double PositionX { get; set; }

    public double PositionY { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
