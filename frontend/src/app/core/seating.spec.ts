import { describe, expect, it } from 'vitest';

import { fourSidedSides } from './seating.service';

describe('fourSidedSides', () => {
  it('gives back the seat count of the four-sided preset', () => {
    expect(fourSidedSides(10)).toEqual({ short: 2, long: 3 });
  });

  it('adds up to the stored count for every pair of sides the form offers', () => {
    for (let short = 1; short <= 10; short++) {
      for (let long = short; long <= 10; long++) {
        const n = short * 2 + long * 2;
        const sides = fourSidedSides(n);
        expect(sides.short * 2 + sides.long * 2).toBe(n);
      }
    }
  });

  it('stays inside what the selects can show', () => {
    expect(fourSidedSides(1)).toEqual({ short: 1, long: 1 });
    expect(fourSidedSides(40)).toEqual({ short: 10, long: 10 });
  });
});
