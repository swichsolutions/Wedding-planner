namespace WeddingPlanner.Domain.Entities;

/// <summary>
/// One payment against a budget line („აფიქსირებს გადახდას“, BUILD-PLAN B4): a deposit, an
/// instalment or the rest. The line's <see cref="BudgetItem.Paid"/> is the sum of these.
/// Information only — no money moves through the platform (CLAUDE.md §4).
/// </summary>
public class BudgetPayment
{
    public int Id { get; set; }

    public int BudgetItemId { get; set; }
    public BudgetItem BudgetItem { get; set; } = null!;

    public decimal Amount { get; set; }
    public DateOnly PaidOn { get; set; }
    public string? Note { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
