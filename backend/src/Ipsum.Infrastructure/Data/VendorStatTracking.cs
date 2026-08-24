using Microsoft.EntityFrameworkCore;

namespace Ipsum.Infrastructure.Data;

/// <summary>
/// Atomic per-day engagement counter updates (CLAUDE.md §5 — collected silently from
/// day one as the future featured-placement sales tool). A single Postgres upsert so
/// concurrent requests can't race the (VendorId, Date) unique index — the old
/// check-then-insert pattern 500'd when a vendor's first two events of a day raced.
/// </summary>
public static class VendorStatTracking
{
    public static Task IncrementAsync(
        AppDbContext db,
        int vendorId,
        int views = 0,
        int contacts = 0,
        int messages = 0,
        CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        return db.Database.ExecuteSqlInterpolatedAsync($@"
INSERT INTO ""VendorStats"" (""VendorId"", ""Date"", ""ProfileViews"", ""ContactClicks"", ""Messages"")
VALUES ({vendorId}, {today}, {views}, {contacts}, {messages})
ON CONFLICT (""VendorId"", ""Date"") DO UPDATE SET
    ""ProfileViews"" = ""VendorStats"".""ProfileViews"" + {views},
    ""ContactClicks"" = ""VendorStats"".""ContactClicks"" + {contacts},
    ""Messages"" = ""VendorStats"".""Messages"" + {messages}", ct);
    }
}
