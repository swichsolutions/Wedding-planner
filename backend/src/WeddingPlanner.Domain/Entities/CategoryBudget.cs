namespace WeddingPlanner.Domain.Entities;

/// <summary>
/// A couple's self-set target budget for one vendor category (e.g. "3000 for
/// Photographer"), scoped to the guided planner's per-service calculator — separate
/// from the plan-wide <see cref="Couple.TotalBudget"/>. One row per couple per category.
/// </summary>
public class CategoryBudget
{
    public int Id { get; set; }

    /// <summary>The plan it belongs to (<see cref="Couple"/>).</summary>
    public int CoupleId { get; set; }

    public string CategorySlug { get; set; } = string.Empty;

    public decimal Amount { get; set; }
}
