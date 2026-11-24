// Wedding budget allocation model — pure logic, unit-tested. Georgian wedding norms:
// venue/catering dominates (supra culture); percentages sum to 100. The shares are those of
// Beka's budget article (2026-11-24): a tenth of the budget is kept as a reserve, inside the total.

export interface BudgetCategory {
  key: string; // i18n key under "budgetCat"
  pct: number;
}

export const BUDGET_CATEGORIES: BudgetCategory[] = [
  { key: 'venue', pct: 40 },
  { key: 'photoVideo', pct: 11 },
  { key: 'decor', pct: 9 },
  { key: 'music', pct: 8 },
  { key: 'attire', pct: 7 },
  { key: 'rings', pct: 4 },
  { key: 'beauty', pct: 3 },
  { key: 'cake', pct: 3 },
  { key: 'transport', pct: 2 },
  { key: 'misc', pct: 3 },
  { key: 'reserve', pct: 10 },
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

/**
 * How each estimator row spreads over the rows of the real budget (BudgetController.DefaultItems,
 * which must carry the same shares): category slug and its share within the row. Two rows have no
 * category: "invitations and other", then the reserve. `nth` tells them apart by their order.
 */
export const ESTIMATOR_ROWS: Record<string, { slug: string | null; weight: number; nth?: number }[]> = {
  venue: [{ slug: 'darbazi', weight: 40 }],
  photoVideo: [{ slug: 'fotografi', weight: 7 }, { slug: 'videografi', weight: 4 }],
  decor: [{ slug: 'dekori', weight: 5 }, { slug: 'floristi', weight: 4 }],
  music: [{ slug: 'musika', weight: 8 }],
  attire: [{ slug: 'kaba', weight: 4 }, { slug: 'kostiumi', weight: 3 }],
  rings: [{ slug: 'bechdebi', weight: 4 }],
  beauty: [{ slug: 'makiaji', weight: 2 }, { slug: 'tmis-stili', weight: 1 }],
  cake: [{ slug: 'torti', weight: 3 }],
  transport: [{ slug: 'transporti', weight: 2 }],
  misc: [{ slug: null, weight: 3, nth: 0 }],
  reserve: [{ slug: null, weight: 10, nth: 1 }],
};

/** One estimate to carry into the budget: the row is the `nth` one (0 = first) with this category slug. */
export interface EstimatorEdit {
  slug: string | null;
  nth: number;
  estimate: number;
}

/**
 * The estimate each budget row should get from the estimator's amounts, only for rows the visitor
 * changed. Amounts kept from an older list of rows (a different count) carry nothing.
 */
export function estimatorEdits(total: number, amounts: readonly number[]): EstimatorEdit[] {
  if (amounts.length !== BUDGET_CATEGORIES.length) return [];
  const suggested = suggestedAllocation(total);
  const edits: EstimatorEdit[] = [];
  BUDGET_CATEGORIES.forEach((c, i) => {
    if (amounts[i] === undefined || amounts[i] === suggested[i]) return;
    const parts = ESTIMATOR_ROWS[c.key] ?? [];
    const weights = parts.reduce((sum, p) => sum + p.weight, 0);
    let left = amounts[i];
    parts.forEach((p, n) => {
      const estimate = n === parts.length - 1 ? left : Math.round((amounts[i] * p.weight) / weights);
      left -= estimate;
      edits.push({ slug: p.slug, nth: p.nth ?? 0, estimate });
    });
  });
  return edits;
}
