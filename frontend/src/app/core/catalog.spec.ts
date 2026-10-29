import { describe, expect, it } from 'vitest';

import {
  CATEGORIES,
  CITIES,
  FEATURES,
  GROUPS,
  PRICE_UNITS,
  REGIONS,
  SETTINGS,
  STYLES,
  TRAVEL_POLICIES,
  VENUE_TYPES,
  categoriesIn,
  categoryKey,
  cityName,
  defaultUnit,
  stylesFor,
} from './catalog';
import ka from '../i18n/ka.json';
import en from '../i18n/en.json';

/** Look a dotted key up in a translation file. */
const t = (dict: unknown, key: string): unknown =>
  key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], dict);

describe('catalog taxonomy (PROPOSALS.md P1–P5)', () => {
  it('puts every category in a known group, and every group has categories', () => {
    for (const c of CATEGORIES) expect(GROUPS).toContain(c.group);
    for (const g of GROUPS) expect(categoriesIn(g).length).toBeGreaterThan(0);
    expect(CATEGORIES.length).toBe(27);
  });

  it('keeps the 14 live category URLs', () => {
    const live = ['fotografi', 'darbazi', 'dekori', 'floristi', 'makiaji', 'tmis-stili', 'manikiuri',
      'videografi', 'torti', 'musika', 'kaba', 'kostiumi', 'bechdebi', 'transporti'];
    for (const slug of live) expect(CATEGORIES.some((c) => c.slug === slug)).toBe(true);
  });

  it('has a Georgian and an English name for every label the catalog shows', () => {
    const keys = [
      ...CATEGORIES.map((c) => c.key),
      ...GROUPS.map((g) => `catalog.groups.${g}`),
      ...REGIONS.map((r) => `catalog.regions.${r}`),
      ...STYLES.map((s) => `catalog.styles.${s}`),
      ...Object.values(FEATURES).flat().map((f) => `catalog.features.${f}`),
      ...PRICE_UNITS.map((u) => `catalog.units.${u}`),
      ...SETTINGS.map((s) => `catalog.settings.${s}`),
      ...VENUE_TYPES.map((v) => `catalog.venueTypes.${v}`),
      ...TRAVEL_POLICIES.map((p) => `catalog.travel.${p}`),
    ];
    for (const key of keys) {
      expect(typeof t(ka, key), `ka: ${key}`).toBe('string');
      expect(typeof t(en, key), `en: ${key}`).toBe('string');
    }
  });

  it('prices venues per guest, cakes per kilo, everyone else per event', () => {
    expect(defaultUnit('venues')).toBe('guest');
    expect(defaultUnit('cake')).toBe('kg');
    expect(defaultUnit('photo')).toBe('event');
    expect(defaultUnit(undefined)).toBe('event');
  });

  it('offers styles to photo/video and decor only; documentary to photo/video only', () => {
    expect(stylesFor('photo')).toContain('documentary');
    expect(stylesFor('decor')).not.toContain('documentary');
    expect(stylesFor('decor').length).toBeGreaterThan(0);
    expect(stylesFor('cake')).toEqual([]);
  });
});

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
