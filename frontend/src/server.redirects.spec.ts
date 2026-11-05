import { describe, expect, it } from 'vitest';
import { APEX, redirectFor } from './server.redirects';

const get = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers });

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

  it('moves old article URLs under /guides/blog, keeping the query', () => {
    const res = redirectFor(get(`https://${APEX}/guides/old-slug?x=1`));
    expect(res?.status).toBe(301);
    expect(res?.headers.get('location')).toBe(`https://${APEX}/guides/blog/old-slug?x=1`);
  });

  it('does not touch the guide sections or deeper article paths', () => {
    for (const path of ['/guides', '/guides/blog', '/guides/inspiration', '/guides/real-weddings', '/guides/blog/x']) {
      expect(redirectFor(get(`https://${APEX}${path}`))).toBeNull();
    }
  });
});
