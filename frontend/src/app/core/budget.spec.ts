import { describe, expect, it } from 'vitest';

import { BUDGET_CATEGORIES, suggestedAllocation } from './budget';

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

  it('makes venue the largest single allocation', () => {
    const amounts = suggestedAllocation(10000);
    expect(amounts[0]).toBe(Math.max(...amounts));
  });
});
