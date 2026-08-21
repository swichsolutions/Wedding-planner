import { describe, expect, it } from 'vitest';

import { CATEGORIES, CITIES, categoryKey, cityName } from './catalog';

describe('catalog', () => {
  it('has unique category slugs', () => {
    const slugs = CATEGORIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('has unique city slugs', () => {
    expect(new Set(CITIES.map((c) => c.slug)).size).toBe(CITIES.length);
  });

  it('maps a known category slug to its i18n key', () => {
    expect(categoryKey('fotografi')).toBe('category.photographer');
  });

  it('falls back to the slug for an unknown category', () => {
    expect(categoryKey('does-not-exist')).toBe('does-not-exist');
  });

  it('maps a known city slug to its Georgian name', () => {
    expect(cityName('tbilisi')).toBe('თბილისი');
  });

  it('falls back to the slug for an unknown city', () => {
    expect(cityName('atlantis')).toBe('atlantis');
  });
});
