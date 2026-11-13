import { describe, expect, it } from 'vitest';

import ka from '../i18n/ka.json';
import { CATEGORIES, GROUPS, GROUP_SLUGS, categoryPath, groupBySlug, groupPath, isCategory } from './catalog';
import { KIND_SECTION } from './content.models';
import { DAY_SCHEDULES } from './day-schedules';
import { movedAddress } from './old-addresses';
import { SCHEDULE_SLUGS, scheduleBySlug, schedulePath } from './schedule-addresses';

/**
 * The letter table of the API's Slugs.cs. One letter differs: ფ is "f" here, as the site's
 * category slugs write it (fotografi, floristi); Slugs.cs writes "p".
 */
const LATIN: Record<string, string> = {
  ა: 'a', ბ: 'b', გ: 'g', დ: 'd', ე: 'e', ვ: 'v', ზ: 'z', თ: 't', ი: 'i', კ: 'k', ლ: 'l', მ: 'm',
  ნ: 'n', ო: 'o', პ: 'p', ჟ: 'zh', რ: 'r', ს: 's', ტ: 't', უ: 'u', ფ: 'f', ქ: 'q', ღ: 'gh', ყ: 'q',
  შ: 'sh', ჩ: 'ch', ც: 'ts', ძ: 'dz', წ: 'ts', ჭ: 'ch', ხ: 'kh', ჯ: 'j', ჰ: 'h',
};
const latin = (text: string): string =>
  [...text.toLowerCase()]
    .map((ch) => LATIN[ch] ?? (/[a-z0-9]/.test(ch) ? ch : '-'))
    .join('')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');

describe('the catalog groups’ addresses', () => {
  it('are the groups’ Georgian names in Latin letters', () => {
    const names = ka.catalog.groups as Record<string, string>;
    for (const g of GROUPS) expect(GROUP_SLUGS[g]).toBe(latin(names[g]));
    expect(GROUP_SLUGS.venues).toBe('sivrtseebi-da-kveba');
    expect(GROUP_SLUGS.photo).toBe('foto-da-video');
  });

  it('are nine different ones, and none is a category’s', () => {
    const slugs = GROUPS.map((g) => GROUP_SLUGS[g]);
    expect(new Set(slugs).size).toBe(9);
    for (const s of slugs) expect(isCategory(s)).toBe(false);
  });

  it('read both ways', () => {
    for (const g of GROUPS) {
      expect(groupBySlug(GROUP_SLUGS[g])).toBe(g);
      expect(groupPath(g)).toBe(`/${GROUP_SLUGS[g]}`);
    }
    expect(groupBySlug('fotografi')).toBeUndefined();
    expect(groupBySlug(null)).toBeUndefined();
    expect(groupPath(null)).toBe('/vendors');
  });

  it('give a category its slug, and the whole catalog to a slug with no page', () => {
    for (const c of CATEGORIES) expect(categoryPath(c.slug)).toBe(`/${c.slug}`);
    expect(categoryPath('gantavseba')).toBe('/vendors'); // retired
    expect(categoryPath('custom-line')).toBe('/vendors');
    expect(categoryPath(null)).toBe('/vendors');
  });
});

describe('the day schedules’ addresses', () => {
  it('give every example its own page, and read both ways', () => {
    expect(Object.keys(SCHEDULE_SLUGS).sort()).toEqual(DAY_SCHEDULES.map((s) => s.key).sort());
    for (const s of DAY_SCHEDULES) {
      expect(schedulePath(s.key)).toBe(`/ganrigebi/${SCHEDULE_SLUGS[s.key]}`);
      expect(scheduleBySlug(SCHEDULE_SLUGS[s.key])).toBe(s.key);
    }
    expect(schedulePath('one-venue')).toBe('/ganrigebi/khelis-motsera');
    expect(schedulePath('church-restaurant')).toBe('/ganrigebi/jvristsera');
    expect(schedulePath('reception-only')).toBe('/ganrigebi/mkholod-tsveuleba');
  });

  it('fall back to the schedules page for a key that names nothing', () => {
    for (const key of ['zzz', 'constructor', '', null, undefined]) expect(schedulePath(key)).toBe('/ganrigebi');
    expect(scheduleBySlug('zzz')).toBeUndefined();
  });
});

// The full list of old → new is in server.redirects.spec.ts (the same function answers there).
describe('movedAddress', () => {
  it('takes a link as written: path, query and fragment', () => {
    expect(movedAddress('/vendors?category=fotografi')).toBe('/fotografi');
    expect(movedAddress('/vendors?group=venues&region=kakheti#top')).toBe('/sivrtseebi-da-kveba?region=kakheti#top');
    expect(movedAddress('/schedules')).toBe('/ganrigebi');
    expect(movedAddress('/guides/inspiration')).toBe(KIND_SECTION.inspiration);
  });

  it('leaves everything else alone', () => {
    for (const link of ['/', '/vendors', '/budget?view=overview', '/fotografi', '/planning/day?use=one-venue', 'https://example.com/guides', '']) {
      expect(movedAddress(link)).toBeNull();
    }
  });
});
