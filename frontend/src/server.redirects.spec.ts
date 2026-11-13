import { describe, expect, it } from 'vitest';
import { APEX, redirectFor } from './server.redirects';

const get = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers });

/** Where a request for `path` on the live site is sent, or null when it is rendered. */
const sentTo = (path: string): string | null => {
  const res = redirectFor(get(`https://${APEX}${path}`));
  if (!res) return null;
  expect(res.status).toBe(301);
  return res.headers.get('location')!.replace(`https://${APEX}`, '');
};

describe('redirectFor', () => {
  it('sends www to the apex, keeping path and query', () => {
    const res = redirectFor(get(`https://www.${APEX}/vendors?page=2`));
    expect(res?.status).toBe(301);
    expect(res?.headers.get('location')).toBe(`https://${APEX}/vendors?page=2`);
  });

  it('also honours a www Host header when the URL host differs (local proxies)', () => {
    const res = redirectFor(get('http://127.0.0.1:8787/about', { host: `www.${APEX}:8787` }));
    expect(res?.status).toBe(301);
    expect(res?.headers.get('location')).toBe(`http://${APEX}/about`);
  });

  it('leaves the apex alone (no redirect loop)', () => {
    expect(redirectFor(get(`https://${APEX}/`, { host: APEX }))).toBeNull();
    expect(redirectFor(get(`https://${APEX}/vendors`))).toBeNull();
  });

  it('moves the tips pages from /guides to /rchevebi, keeping the query', () => {
    expect(sentTo('/guides')).toBe('/rchevebi');
    expect(sentTo('/guides/')).toBe('/rchevebi');
    expect(sentTo('/guides/blog')).toBe('/rchevebi/blogi');
    expect(sentTo('/guides/blog?topic=budget')).toBe('/rchevebi/blogi?topic=budget');
    expect(sentTo('/guides/inspiration')).toBe('/rchevebi/shtagoneba');
    expect(sentTo('/guides/real-weddings')).toBe('/rchevebi/realuri-qortsilebi');
    expect(sentTo('/guides/blog/qortsilis-biujeti')).toBe('/rchevebi/blogi/qortsilis-biujeti');
    expect(sentTo('/guides/inspiration/x?utm_source=ig')).toBe('/rchevebi/shtagoneba/x?utm_source=ig');
    expect(sentTo('/guides/real-weddings/nino-da-giorgi')).toBe('/rchevebi/realuri-qortsilebi/nino-da-giorgi');
  });

  it('sends the oldest article URLs (/guides/<slug>) to the blog in one hop', () => {
    expect(sentTo('/guides/old-slug?x=1')).toBe('/rchevebi/blogi/old-slug?x=1');
    // a name every object has must not be taken for a section
    expect(sentTo('/guides/constructor')).toBe('/rchevebi/blogi/constructor');
  });

  it('moves the day schedules to /ganrigebi, the chosen one into the path', () => {
    expect(sentTo('/schedules')).toBe('/ganrigebi');
    expect(sentTo('/schedules?s=one-venue')).toBe('/ganrigebi/khelis-motsera');
    expect(sentTo('/schedules?s=church-restaurant')).toBe('/ganrigebi/jvristsera');
    expect(sentTo('/schedules?s=reception-only&fbclid=abc')).toBe('/ganrigebi/mkholod-tsveuleba?fbclid=abc');
    // an unknown one: the page moved all the same, the parameter is left as it came
    expect(sentTo('/schedules?s=zzz')).toBe('/ganrigebi?s=zzz');
    expect(sentTo('/schedules?s=constructor')).toBe('/ganrigebi?s=constructor');
  });

  it('gives a catalog group and a category their own address, keeping the filters', () => {
    expect(sentTo('/vendors?group=venues')).toBe('/sivrtseebi-da-kveba');
    expect(sentTo('/vendors?group=photo&region=kakheti&sort=price_asc')).toBe('/foto-da-video?region=kakheti&sort=price_asc');
    expect(sentTo('/vendors?category=bechdebi')).toBe('/bechdebi');
    expect(sentTo('/vendors?category=darbazi&features=accommodation')).toBe('/darbazi?features=accommodation');
    // the old category chips named the group too: it is part of the category's address now
    expect(sentTo('/vendors?group=photo&category=fotografi&maxPrice=2000')).toBe('/fotografi?maxPrice=2000');
  });

  it('leaves the catalog alone when the parameter names nothing, or there is none', () => {
    for (const path of ['/vendors', '/vendors?q=tbilisi', '/vendors?region=kakheti', '/vendors?group=zzz', '/vendors?category=zzz', '/vendors?group=constructor']) {
      expect(sentTo(path)).toBeNull();
    }
    // a known group beside an unknown category: the group moves, the rest stays
    expect(sentTo('/vendors?group=photo&category=zzz')).toBe('/foto-da-video?category=zzz');
  });

  it('does not touch the new addresses (no redirect loop)', () => {
    for (const path of ['/rchevebi', '/rchevebi/blogi', '/rchevebi/blogi/x', '/ganrigebi', '/ganrigebi/jvristsera', '/foto-da-video', '/fotografi?region=kakheti', '/fotografi/tbilisi', '/guides/blog/a/b']) {
      expect(sentTo(path)).toBeNull();
    }
  });
});
