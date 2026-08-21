using System.Security.Claims;
using Ipsum.Api.Auth;
using Ipsum.Api.Dtos;
using Ipsum.Domain.Entities;
using Ipsum.Infrastructure.Data;
using Ipsum.Infrastructure.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ipsum.Api.Controllers;

/// <summary>
/// Vendor reviews: public read; couples submit one review each per vendor
/// (resubmitting updates it in place). Aggregates ride on the vendor DTO.
/// </summary>
[ApiController]
[Route("api/vendors/{vendorId:int}/reviews")]
public class ReviewsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<AppUser> _users;

    public ReviewsController(AppDbContext db, UserManager<AppUser> users)
    {
        _db = db;
        _users = users;
    }

    private string? UserId => User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    /// <summary>All reviews for a vendor, newest first. `mine` marks the caller's own.</summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<ReviewDto>>> List(int vendorId)
    {
        if (!await _db.Vendors.AnyAsync(v => v.Id == vendorId && v.IsApproved))
            return NotFound();

        var uid = UserId;
        var reviews = await _db.Reviews
            .AsNoTracking()
            .Where(r => r.VendorId == vendorId)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();

        return Ok(reviews.Select(r =>
            new ReviewDto(r.Id, r.AuthorName, r.Rating, r.Body, r.CreatedAt, uid != null && r.UserId == uid)));
    }

    /// <summary>Create or update the signed-in couple's review of this vendor.</summary>
    [HttpPost]
    [Authorize(Roles = Roles.Couple)]
    public async Task<ActionResult<ReviewDto>> Submit(int vendorId, [FromBody] SubmitReviewDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (UserId is not string uid) return Forbid();

        if (!await _db.Vendors.AnyAsync(v => v.Id == vendorId && v.IsApproved))
            return NotFound();

        var now = DateTimeOffset.UtcNow;
        var review = await _db.Reviews
            .FirstOrDefaultAsync(r => r.VendorId == vendorId && r.UserId == uid);

        if (review is null)
        {
            review = new Review
            {
                VendorId = vendorId,
                UserId = uid,
                AuthorName = await AuthorNameAsync(uid),
                CreatedAt = now,
            };
            _db.Reviews.Add(review);
        }
        else
        {
            review.UpdatedAt = now;
        }

        review.Rating = dto.Rating;
        review.Body = string.IsNullOrWhiteSpace(dto.Body) ? null : dto.Body.Trim();
        await _db.SaveChangesAsync();

        return Ok(new ReviewDto(review.Id, review.AuthorName, review.Rating, review.Body, review.CreatedAt, true));
    }

    /// <summary>
    /// Public byline: couple's first name + last initial ("ნინო გ."), falling back to
    /// the account display name, then a generic label. Captured once at first submit.
    /// </summary>
    private async Task<string> AuthorNameAsync(string uid)
    {
        var couple = await _db.Couples.AsNoTracking().FirstOrDefaultAsync(c => c.UserId == uid);
        var first = couple?.FirstName?.Trim();
        if (!string.IsNullOrEmpty(first))
        {
            var lastInitial = couple?.LastName?.Trim() is { Length: > 0 } last ? $" {last[0]}." : string.Empty;
            return first + lastInitial;
        }

        var user = await _users.FindByIdAsync(uid);
        return user?.DisplayName?.Trim() is { Length: > 0 } dn ? dn : "წყვილი";
    }
}
