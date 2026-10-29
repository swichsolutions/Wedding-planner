using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using WeddingPlanner.Domain.Entities;
using WeddingPlanner.Infrastructure.Data;

namespace WeddingPlanner.Api.Planning;

/// <summary>
/// Which plan a request works on (BUILD-PLAN B1, D8). Every organizer controller asks this instead
/// of reading the user id, so both partners see and edit the same checklist, budget, guests,
/// seating, invitation and saved vendors. Scoped: the lookup runs once per request.
/// </summary>
public class CoupleScope
{
    private readonly AppDbContext _db;
    private readonly IHttpContextAccessor _http;
    private int? _id;

    public CoupleScope(AppDbContext db, IHttpContextAccessor http)
    {
        _db = db;
        _http = http;
    }

    public string? UserId => _http.HttpContext?.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    /// <summary>
    /// The signed-in account's plan, starting an empty one the first time (an account from before
    /// sign-up made one, or one that left a shared plan). Null only without a user id (→ 403).
    /// </summary>
    public async Task<int?> IdAsync()
    {
        if (_id is int known) return known;
        if (UserId is not string uid) return null;

        _id = await _db.CoupleMembers.Where(m => m.UserId == uid).Select(m => (int?)m.CoupleId).FirstOrDefaultAsync()
              ?? await StartPlanAsync(uid);
        return _id;
    }

    /// <summary>The account's membership (null if it has no plan yet).</summary>
    public Task<CoupleMember?> MembershipAsync(string uid) =>
        _db.CoupleMembers.Include(m => m.Couple).FirstOrDefaultAsync(m => m.UserId == uid);

    /// <summary>Forget the cached id (after joining or leaving a plan within the same request).</summary>
    public void Reset() => _id = null;

    private async Task<int> StartPlanAsync(string uid)
    {
        var plan = NewPlan(uid);
        _db.Couples.Add(plan);
        try
        {
            await _db.SaveChangesAsync();
            return plan.Id;
        }
        catch (DbUpdateException ex) when (DbErrors.IsUniqueViolation(ex))
        {
            // A parallel first request started the plan (one membership per account): use theirs.
            _db.Entry(plan).State = EntityState.Detached;
            foreach (var m in plan.Members) _db.Entry(m).State = EntityState.Detached;
            return await _db.CoupleMembers.Where(m => m.UserId == uid).Select(m => m.CoupleId).FirstAsync();
        }
    }

    /// <summary>A new, empty plan with this account as its first member (not saved).</summary>
    public static Couple NewPlan(string uid)
    {
        var now = DateTimeOffset.UtcNow;
        var plan = new Couple { CreatedAt = now };
        plan.Members.Add(new CoupleMember { UserId = uid, JoinedAt = now });
        return plan;
    }
}
