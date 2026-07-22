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

/** Suggested amount per category for a given total, in category order. */
export function suggestedAllocation(total: number): number[] {
  const safeTotal = Number.isFinite(total) && total > 0 ? total : 0;
  return BUDGET_CATEGORIES.map((c) => Math.round((safeTotal * c.pct) / 100));
}
