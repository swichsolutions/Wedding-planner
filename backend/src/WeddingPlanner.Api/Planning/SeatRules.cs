using Microsoft.EntityFrameworkCore;
using WeddingPlanner.Domain.Entities;
using WeddingPlanner.Infrastructure.Data;

namespace WeddingPlanner.Api.Planning;

/// <summary>The seating chart follows the guest list (B5), whoever changed it: the couple on the
/// guest list or the guest on the invitation (B6).</summary>
public static class SeatRules
{
    /// <summary>A declined party gives up all its seats; a plus-one or child no longer coming gives
    /// up theirs. Call after the guest row is saved.</summary>
    public static Task FreeSeatsAsync(AppDbContext db, Guest g) =>
        db.SeatAssignments
            .Where(a => a.GuestId == g.Id && (g.Attendance == "no"
                || (a.AttendeeKind == "plus_one" && !g.HasPlusOne)
                || (a.AttendeeKind == "child" && !g.HasChild)))
            .ExecuteDeleteAsync();
}
