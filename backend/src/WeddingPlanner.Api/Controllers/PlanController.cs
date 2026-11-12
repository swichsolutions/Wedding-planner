using System.Security.Cryptography;
using System.Text;
using WeddingPlanner.Api.Auth;
using WeddingPlanner.Api.Dtos;
using WeddingPlanner.Api.Email;
using WeddingPlanner.Api.Planning;
using WeddingPlanner.Domain.Entities;
using WeddingPlanner.Infrastructure.Data;
using WeddingPlanner.Infrastructure.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace WeddingPlanner.Api.Controllers;

/// <summary>
/// The shared wedding plan (BUILD-PLAN B1, decision D8): its details (the start form after sign-up
/// and the settings page), and partner access — one invitation link at a time, single-use, 14
/// days, optionally emailed. A plan has at most two people; either can remove the other or leave.
/// </summary>
[ApiController]
[Route("api/plan")]
[Authorize(Roles = Roles.Couple)]
public class PlanController : ControllerBase
{
    /// <summary>The guest-count choices (frontend core/onboarding.ts).</summary>
    private static readonly string[] GuestRanges = { "0-50", "51-100", "101-150", "151-200", "201-300", "300plus", "notSure" };
    private const int MaxMembers = 2;
    /// <summary>
    /// Invitations mailed per plan per day. The address is whatever the couple types, so without
    /// a cap the form could mail a stranger over and over. A link without mail is not counted.
    /// </summary>
    private const int MaxEmailedInvitesPerDay = 3;

    private readonly AppDbContext _db;
    private readonly CoupleScope _couple;
    private readonly UserManager<AppUser> _users;
    private readonly EmailOutbox _outbox;
    private readonly EmailDelivery _delivery;
    private readonly IConfiguration _config;
    private readonly IMemoryCache _cache;

    public PlanController(
        AppDbContext db, CoupleScope couple, UserManager<AppUser> users,
        EmailOutbox outbox, EmailDelivery delivery, IConfiguration config, IMemoryCache cache)
    {
        _db = db;
        _couple = couple;
        _users = users;
        _outbox = outbox;
        _delivery = delivery;
        _config = config;
        _cache = cache;
    }

    [HttpGet]
    public async Task<ActionResult<PlanDto>> Get()
    {
        if (await _couple.IdAsync() is not int cid) return Forbid();
        return Ok(await LoadAsync(cid));
    }

    /// <summary>Save the plan's details. Unknown region / guest values are dropped, not stored.</summary>
    [HttpPut]
    public async Task<ActionResult<PlanDto>> Update([FromBody] PlanUpdateDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (await _couple.IdAsync() is not int cid) return Forbid();

        var plan = await _db.Couples.FirstAsync(c => c.Id == cid);
        plan.FirstName = Clean(dto.FirstName);
        plan.LastName = Clean(dto.LastName);
        plan.PartnerFirstName = Clean(dto.PartnerFirstName);
        plan.PartnerLastName = Clean(dto.PartnerLastName);
        plan.WeddingDate = dto.WeddingDate;
        plan.City = Clean(dto.City);
        plan.Region = CatalogRules.OneOf(dto.Region, CatalogRules.Regions);
        plan.GuestCountRange = CatalogRules.OneOf(dto.GuestCountRange, GuestRanges);
        await _db.SaveChangesAsync();

        return Ok(await LoadAsync(cid));
    }

    /// <summary>
    /// Start over with new answers: overwrites the details and wipes the checklist and budget,
    /// which reseed from the new answers on their next load. Destructive by design (the client
    /// confirms first); it affects both partners. The guest list stays: the couple is only told
    /// about tasks and budget, and guests may already have answered their invitations.
    /// </summary>
    [HttpPut("restart")]
    public async Task<ActionResult<PlanDto>> Restart([FromBody] CoupleRestartDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (await _couple.IdAsync() is not int cid) return Forbid();

        await using var tx = await _db.Database.BeginTransactionAsync();
        var plan = await _db.Couples.FirstAsync(c => c.Id == cid);
        plan.FirstName = Clean(dto.FirstName);
        plan.LastName = Clean(dto.LastName);
        plan.PartnerFirstName = Clean(dto.PartnerFirstName);
        plan.PartnerLastName = Clean(dto.PartnerLastName);
        plan.WeddingDate = dto.WeddingDate;
        plan.PlanningStage = Clean(dto.PlanningStage);
        plan.GuestCountRange = CatalogRules.OneOf(dto.GuestCountRange, GuestRanges);
        plan.NeededCategories = dto.NeededCategories ?? new List<string>();
        plan.TotalBudget = null; // a fresh plan starts without a carried-over total

        await _db.ChecklistItems.Where(c => c.CoupleId == cid).ExecuteDeleteAsync();
        await _db.BudgetItems.Where(b => b.CoupleId == cid).ExecuteDeleteAsync();
        await _db.CategoryBudgets.Where(c => c.CoupleId == cid).ExecuteDeleteAsync();

        await _db.SaveChangesAsync();
        await tx.CommitAsync();
        return Ok(await LoadAsync(cid));
    }

    // ------------------------------------------------------------------ partner access

    /// <summary>
    /// A new invitation link (replacing any open one), shown once. With an email and mail set up,
    /// the link is also emailed; the response says whether it was. Emailed invitations are capped
    /// per plan per day (429 with code "mailLimit" over the cap; the open link is left as it was).
    /// </summary>
    [HttpPost("invite")]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<PlanInviteCreatedDto>> CreateInvite([FromBody] PlanInviteCreateDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (await _couple.IdAsync() is not int cid || _couple.UserId is not string uid) return Forbid();

        var members = await _db.CoupleMembers.Where(m => m.CoupleId == cid).ToListAsync();
        if (members.Count >= MaxMembers) return Conflict(new { code = "full" });

        var email = string.IsNullOrWhiteSpace(dto.Email) ? null : dto.Email.Trim();
        var willMail = email is not null && _delivery.Enabled;
        // Checked before anything changes, so a refused request doesn't replace the open link.
        // Requests in flight together may pass the cap by one; it is a brake, not a quota.
        var mailedKey = $"partner-invite-mail:{cid}:{DateTimeOffset.UtcNow:yyyyMMdd}";
        var mailedToday = _cache.TryGetValue(mailedKey, out int mailed) ? mailed : 0;
        if (willMail && mailedToday >= MaxEmailedInvitesPerDay)
            return StatusCode(StatusCodes.Status429TooManyRequests, new { code = "mailLimit" });

        await _db.CoupleInvites.Where(i => i.CoupleId == cid && i.AcceptedAt == null).ExecuteDeleteAsync();

        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
        var now = DateTimeOffset.UtcNow;
        var invite = new CoupleInvite
        {
            CoupleId = cid,
            TokenHash = Hash(token),
            Email = email,
            CreatedByUserId = uid,
            CreatedAt = now,
            ExpiresAt = now + PartnerInviteEmail.LinkLifetime,
        };
        _db.CoupleInvites.Add(invite);
        await _db.SaveChangesAsync();

        var link = $"{SiteLinks.FrontendOrigin(_config)}/partner/{token}";
        var emailed = false;
        if (willMail)
        {
            var me = members.First(m => m.UserId == uid);
            var plan = await _db.Couples.AsNoTracking().FirstAsync(c => c.Id == cid);
            var inviter = me.IsPartner ? plan.PartnerFirstName : plan.FirstName;
            emailed = _outbox.TryEnqueue(PartnerInviteEmail.Build(email!, link, inviter, dto.Lang, SiteLinks.Brand(_config)));
            // Only mail that was queued counts against the day.
            if (emailed) _cache.Set(mailedKey, mailedToday + 1, TimeSpan.FromDays(1));
        }

        return Ok(new PlanInviteCreatedDto(link, invite.ExpiresAt, emailed));
    }

    [HttpDelete("invite")]
    public async Task<IActionResult> RevokeInvite()
    {
        if (await _couple.IdAsync() is not int cid) return Forbid();
        await _db.CoupleInvites.Where(i => i.CoupleId == cid && i.AcceptedAt == null).ExecuteDeleteAsync();
        return NoContent();
    }

    /// <summary>What an invitation link leads to, for the page it opens (no sign-in needed).</summary>
    [HttpGet("invites/{token}")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<PlanInvitePreviewDto>> PreviewInvite(string token)
    {
        var invite = await FindInviteAsync(token);
        if (invite is null) return Ok(new PlanInvitePreviewDto("invalid", null));
        var names = Names(invite.Couple);
        return Ok(new PlanInvitePreviewDto(InviteStatus(invite), names));
    }

    /// <summary>
    /// Join the plan behind an invitation. Someone who already has a plan with anything in it
    /// (or shares one) must confirm with <c>replace</c>: they leave it, and it's deleted if nobody
    /// else is on it. An empty plan of their own (e.g. made at sign-up a minute ago) just goes.
    /// </summary>
    [HttpPost("invites/{token}/accept")]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<PlanDto>> AcceptInvite(string token, [FromBody] PlanInviteAcceptDto dto)
    {
        if (_couple.UserId is not string uid) return Forbid();

        if (string.IsNullOrWhiteSpace(token) || token.Length > 100) return NotFound(new { code = "invalid" });

        await using var tx = await _db.Database.BeginTransactionAsync();
        // Lock the invitation row: two people accepting the same link at once would both pass
        // the checks below; the second now waits and then sees it used.
        var hash = Hash(token);
        await _db.Database.ExecuteSqlInterpolatedAsync(
            $"SELECT 1 FROM \"CoupleInvites\" WHERE \"TokenHash\" = {hash} FOR UPDATE");
        var invite = await FindInviteAsync(token, track: true);
        if (invite is null) return NotFound(new { code = "invalid" });

        var mine = await _db.CoupleMembers.AsNoTracking().FirstOrDefaultAsync(m => m.UserId == uid);
        if (mine?.CoupleId == invite.CoupleId) return Ok(await LoadAsync(invite.CoupleId)); // already on it

        var status = InviteStatus(invite);
        if (status != "ok") return Conflict(new { code = status });

        if (mine is not null)
        {
            var othersOnMine = await _db.CoupleMembers.CountAsync(m => m.CoupleId == mine.CoupleId && m.UserId != uid);
            if (!dto.Replace && (othersOnMine > 0 || await HasContentAsync(mine.CoupleId)))
                return Conflict(new { code = "hasPlan", shared = othersOnMine > 0 });

            if (othersOnMine == 0)
                await _db.Couples.Where(c => c.Id == mine.CoupleId).ExecuteDeleteAsync(); // its rows and the membership go with it
            else
                await _db.CoupleMembers.Where(m => m.UserId == uid).ExecuteDeleteAsync();
        }

        // The joiner takes the free side of the plan: Partner* if the one already on it is First*.
        var existing = invite.Couple.Members.FirstOrDefault();
        var isPartner = existing is null || !existing.IsPartner;
        var now = DateTimeOffset.UtcNow;
        _db.CoupleMembers.Add(new CoupleMember { UserId = uid, CoupleId = invite.CoupleId, IsPartner = isPartner, JoinedAt = now });
        invite.AcceptedAt = now;
        invite.AcceptedByUserId = uid;

        // Fill in their first name on their side if the plan doesn't have it yet.
        var displayName = (await _users.FindByIdAsync(uid))?.DisplayName?.Trim();
        if (!string.IsNullOrEmpty(displayName) && displayName.Length <= 120)
        {
            if (isPartner && string.IsNullOrWhiteSpace(invite.Couple.PartnerFirstName)) invite.Couple.PartnerFirstName = displayName;
            if (!isPartner && string.IsNullOrWhiteSpace(invite.Couple.FirstName)) invite.Couple.FirstName = displayName;
        }

        try
        {
            await _db.SaveChangesAsync();
            await tx.CommitAsync();
        }
        catch (DbUpdateException ex) when (DbErrors.IsUniqueViolation(ex))
        {
            // The same account accepting twice at once: the other request already joined.
            return Conflict(new { code = "used" });
        }

        _couple.Reset();
        return Ok(await LoadAsync(invite.CoupleId));
    }

    /// <summary>Remove the other person's access. They start an empty plan of their own next time.</summary>
    [HttpDelete("partner")]
    public async Task<IActionResult> RemovePartner()
    {
        if (await _couple.IdAsync() is not int cid || _couple.UserId is not string uid) return Forbid();
        await _db.CoupleMembers.Where(m => m.CoupleId == cid && m.UserId != uid).ExecuteDeleteAsync();
        return NoContent();
    }

    /// <summary>Leave a shared plan (it stays with the partner). Not offered when you're alone on it.</summary>
    [HttpPost("leave")]
    public async Task<IActionResult> Leave()
    {
        if (await _couple.IdAsync() is not int cid || _couple.UserId is not string uid) return Forbid();
        if (await _db.CoupleMembers.CountAsync(m => m.CoupleId == cid) < 2) return Conflict(new { code = "alone" });
        await _db.CoupleMembers.Where(m => m.UserId == uid).ExecuteDeleteAsync();
        return NoContent();
    }

    // ------------------------------------------------------------------ helpers

    private async Task<PlanDto> LoadAsync(int cid)
    {
        var plan = await _db.Couples.AsNoTracking().Include(c => c.Members).FirstAsync(c => c.Id == cid);
        var uid = _couple.UserId;
        var userIds = plan.Members.Select(m => m.UserId).ToList();
        var emails = await _db.Users.Where(u => userIds.Contains(u.Id))
            .Select(u => new { u.Id, u.Email, u.DisplayName })
            .ToDictionaryAsync(u => u.Id);

        var members = plan.Members
            .OrderBy(m => m.JoinedAt)
            .Select(m =>
            {
                var side = m.IsPartner ? plan.PartnerFirstName : plan.FirstName;
                var user = emails.GetValueOrDefault(m.UserId);
                return new PlanMemberDto(
                    Clean(side) ?? Clean(user?.DisplayName), user?.Email, m.UserId == uid, m.IsPartner, m.JoinedAt);
            })
            .ToList();

        var now = DateTimeOffset.UtcNow;
        var invite = await _db.CoupleInvites.AsNoTracking()
            .Where(i => i.CoupleId == cid && i.AcceptedAt == null && i.ExpiresAt > now)
            .OrderByDescending(i => i.CreatedAt)
            .Select(i => new PlanInviteDto(i.Email, i.CreatedAt, i.ExpiresAt))
            .FirstOrDefaultAsync();

        return new PlanDto(
            plan.FirstName, plan.LastName, plan.PartnerFirstName, plan.PartnerLastName,
            plan.WeddingDate, plan.City, plan.Region, plan.PlanningStage, plan.GuestCountRange,
            plan.NeededCategories, plan.TotalBudget,
            plan.Members.Any(m => m.UserId == uid && m.IsPartner),
            members,
            invite,
            plan.Members.Count < MaxMembers,
            _delivery.Enabled);
    }

    private async Task<CoupleInvite?> FindInviteAsync(string token, bool track = false)
    {
        if (string.IsNullOrWhiteSpace(token) || token.Length > 100) return null;
        var hash = Hash(token);
        var query = _db.CoupleInvites.Include(i => i.Couple).ThenInclude(c => c.Members).AsQueryable();
        if (!track) query = query.AsNoTracking();
        return await query.FirstOrDefaultAsync(i => i.TokenHash == hash);
    }

    private static string InviteStatus(CoupleInvite invite) =>
        invite.AcceptedAt is not null ? "used"
        : invite.ExpiresAt <= DateTimeOffset.UtcNow ? "expired"
        : invite.Couple.Members.Count >= MaxMembers ? "full"
        : "ok";

    /// <summary>Anything the person would lose by leaving: details or any organizer row.</summary>
    private async Task<bool> HasContentAsync(int cid)
    {
        var plan = await _db.Couples.AsNoTracking().FirstAsync(c => c.Id == cid);
        if (plan.WeddingDate is not null || plan.TotalBudget is not null || !string.IsNullOrWhiteSpace(plan.City)
            || !string.IsNullOrWhiteSpace(plan.PartnerFirstName))
            return true;
        return await _db.ChecklistItems.AnyAsync(x => x.CoupleId == cid)
            || await _db.BudgetItems.AnyAsync(x => x.CoupleId == cid)
            || await _db.Guests.AnyAsync(x => x.CoupleId == cid)
            || await _db.SeatingTables.AnyAsync(x => x.CoupleId == cid)
            || await _db.PlanServices.AnyAsync(x => x.CoupleId == cid)
            || await _db.WeddingDayItems.AnyAsync(x => x.CoupleId == cid)
            || await _db.WeddingSites.AnyAsync(x => x.CoupleId == cid);
    }

    /// <summary>"Nino & Giorgi", "Nino", or null.</summary>
    private static string? Names(Couple plan)
    {
        var a = Clean(plan.FirstName);
        var b = Clean(plan.PartnerFirstName);
        return a is not null && b is not null ? $"{a} & {b}" : a ?? b;
    }

    private static string Hash(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))).ToLowerInvariant();

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
