namespace WeddingPlanner.Domain.Entities;

/// <summary>One occupied seat: a specific attendee (a guest, their plus-one, or their
/// child — see <see cref="AttendeeKind"/>) seated at a specific index on a specific
/// table. A seat with no row here is empty.</summary>
public class SeatAssignment
{
    public int Id { get; set; }

    public string UserId { get; set; } = string.Empty;

    public int TableId { get; set; }
    public SeatingTable? Table { get; set; }

    public int SeatIndex { get; set; }

    public int GuestId { get; set; }
    public Guest? Guest { get; set; }

    /// <summary>"primary", "plus_one", or "child" — which member of that guest's
    /// party is in this seat.</summary>
    public string AttendeeKind { get; set; } = "primary";
}
