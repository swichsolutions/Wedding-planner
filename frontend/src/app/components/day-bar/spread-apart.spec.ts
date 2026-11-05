import { describe, expect, it } from 'vitest';
import { spreadApart } from './spread-apart';

const round = (xs: number[]) => xs.map((x) => Math.round(x * 100) / 100);

describe('spreadApart', () => {
  it('leaves points that are already far enough apart exactly where they are', () => {
    const xs = [0, 40, 57, 63, 100];
    expect(spreadApart(xs, 5)).toEqual(xs);
  });

  it('pushes a close pair apart around its middle, moving no one else', () => {
    expect(round(spreadApart([0, 50, 52, 100], 10))).toEqual([0, 46, 56, 100]);
  });

  it('keeps every neighbour at least the gap apart, in order and on the axis', () => {
    const cases = [
      [0, 42.3, 57.7, 65.4, 100],
      [0, 41.2, 63.7, 71.2, 100],
      [0, 23.1, 34.6, 46.2, 100],
      [0, 0, 0, 0, 0],
      [100, 100, 100],
    ];
    for (const xs of cases) {
      for (const gap of [5, 10, 15, 20, 25]) {
        const out = spreadApart(xs, gap);
        expect(out[0]).toBeGreaterThanOrEqual(0);
        expect(out[out.length - 1]).toBeLessThanOrEqual(100 + 1e-9);
        for (let i = 1; i < out.length; i++) {
          expect(out[i] - out[i - 1]).toBeGreaterThanOrEqual(Math.min(gap, 100 / (xs.length - 1)) - 1e-9);
        }
      }
    }
  });

  it('keeps the first and last points at the ends of the day when the middle bunches up', () => {
    const out = round(spreadApart([0, 23.1, 34.6, 46.2, 100], 20));
    expect(out).toEqual([0, 20, 40, 60, 100]);
  });

  it('spreads evenly when the whole gap cannot fit', () => {
    expect(round(spreadApart([40, 50, 60], 80))).toEqual([0, 50, 100]);
  });

  it('handles one point, or none', () => {
    expect(spreadApart([30], 20)).toEqual([30]);
    expect(spreadApart([], 20)).toEqual([]);
  });
});
