import { describe, expect, it } from 'vitest';

import { cityDisplayEn, cityLocativeKa } from './city-name';

describe('cityLocativeKa (Georgian locative for city names)', () => {
  it('drops a final ი before appending ში', () => {
    expect(cityLocativeKa('თბილისი')).toBe('თბილისში');
    expect(cityLocativeKa('ბათუმი')).toBe('ბათუმში');
    expect(cityLocativeKa('ქუთაისი')).toBe('ქუთაისში');
    expect(cityLocativeKa('რუსთავი')).toBe('რუსთავში');
  });

  it('appends ში directly when the name does not end in ი', () => {
    expect(cityLocativeKa('მცხეთა')).toBe('მცხეთაში');
  });

  it('tolerates whitespace and empty input', () => {
    expect(cityLocativeKa(' თელავი ')).toBe('თელავში');
    expect(cityLocativeKa('')).toBe('');
  });
});

describe('cityDisplayEn (Latin slug → display name)', () => {
  it('capitalizes single-word slugs', () => {
    expect(cityDisplayEn('tbilisi')).toBe('Tbilisi');
    expect(cityDisplayEn('kutaisi')).toBe('Kutaisi');
  });

  it('turns hyphens into spaces with per-word capitals', () => {
    expect(cityDisplayEn('didi-dighomi')).toBe('Didi Dighomi');
  });
});
