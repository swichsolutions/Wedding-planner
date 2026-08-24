// Wedding budget allocation model — pure logic, unit-tested. Georgian wedding norms:
// venue/catering dominates (supra culture); percentages sum to 100.

export interface BudgetCategory {
  key: string; // i18n key under "budgetCat"
  pct: number;
}

export const BUDGET_CATEGORIES: BudgetCategory[] = [
  { key: 'venue', pct: 40 },
  { key: 'photoVideo', pct: 12 },
  { key: 'decor', pct: 10 },
  { key: 'music', pct: 8 },
  { key: 'attire', pct: 8 },
  { key: 'misc', pct: 7 },
  { key: 'rings', pct: 5 },
  { key: 'beauty', pct: 4 },
  { key: 'cake', pct: 3 },
  { key: 'transport', pct: 3 },
];

/**
 * Suggested amount per category for a given total, in category order.
 * Largest-remainder rounding: floor every share, then hand the leftover lari to
 * the categories with the biggest fractional parts — so the amounts always sum
 * exactly to the total (independent per-category rounding drifted a few lari,
 * making the tool flag its own suggestion as "over budget").
 */
export function suggestedAllocation(total: number): number[] {
  const safeTotal = Number.isFinite(total) && total > 0 ? Math.round(total) : 0;
  const exact = BUDGET_CATEGORIES.map((c) => (safeTotal * c.pct) / 100);
  const amounts = exact.map(Math.floor);
  let leftover = safeTotal - amounts.reduce((a, b) => a + b, 0);
  const byRemainder = exact
    .map((value, i) => ({ i, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of byRemainder) {
    if (leftover <= 0) break;
    amounts[i] += 1;
    leftover -= 1;
  }
  return amounts;
}
