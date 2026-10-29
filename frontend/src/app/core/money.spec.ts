import { describe, expect, it } from 'vitest';

import { formatGel } from './money';

describe('formatGel', () => {
  it('groups thousands with a no-break space in Georgian', () => {
    expect(formatGel(8000, 'ka')).toBe('8 000 ₾');
    expect(formatGel(1234567, 'ka')).toBe('1 234 567 ₾');
  });

  it('uses commas in English', () => {
    expect(formatGel(8000, 'en')).toBe('8,000 ₾');
  });

  it('rounds to whole lari and treats nothing as zero', () => {
    expect(formatGel(999.6, 'ka')).toBe('1 000 ₾');
    expect(formatGel(null, 'ka')).toBe('0 ₾');
    expect(formatGel(-1500, 'en')).toBe('-1,500 ₾');
  });

  it('never shows "-0" for a small negative amount', () => {
    expect(formatGel(-0.3, 'ka')).toBe('0 ₾');
  });
});
