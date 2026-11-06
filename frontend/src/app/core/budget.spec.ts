import { describe, expect, it } from 'vitest';

import { BUDGET_CATEGORIES, estimatorEdits, suggestedAllocation } from './budget';

describe('budget allocation', () => {
  it('category percentages sum to 100', () => {
    const sum = BUDGET_CATEGORIES.reduce((acc, c) => acc + c.pct, 0);
    expect(sum).toBe(100);
  });

  it('allocates the full total for a round budget', () => {
    const amounts = suggestedAllocation(10000);
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(10000);
  });

  it('returns one amount per category', () => {
    expect(suggestedAllocation(5000).length).toBe(BUDGET_CATEGORIES.length);
  });

  it('returns all zeros for a non-positive total', () => {
    expect(suggestedAllocation(0).every((x) => x === 0)).toBe(true);
    expect(suggestedAllocation(-100).every((x) => x === 0)).toBe(true);
  });

  it('sums exactly to the total for non-round budgets (largest remainder)', () => {
    for (const total of [25050, 10001, 333, 99999, 7]) {
      expect(suggestedAllocation(total).reduce((a, b) => a + b, 0)).toBe(total);
    }
  });

  it('makes venue the largest single allocation', () => {
    const amounts = suggestedAllocation(10000);
    expect(amounts[0]).toBe(Math.max(...amounts));
  });
});

describe('estimatorEdits', () => {
  it('has nothing to carry when no row was changed', () => {
    expect(estimatorEdits(30000, suggestedAllocation(30000))).toEqual([]);
  });
  it('spreads a changed row over its budget rows, keeping its sum', () => {
    const amounts = suggestedAllocation(30000);
    amounts[1] = 5000; // photo and video
    const edits = estimatorEdits(30000, amounts);
    expect(edits.map((e) => e.slug)).toEqual(['fotografi', 'videografi']);
    expect(edits.reduce((a, e) => a + e.estimate, 0)).toBe(5000);
  });
});
