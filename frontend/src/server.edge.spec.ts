import { describe, expect, it, vi } from 'vitest';
import { EDGE_CACHE_SECONDS, EdgeCache, browserRenderedShell, edgeCacheKey, isCacheablePage, withEdgeCache } from './server.edge';

const B = 'https://weddingplanner.ge';
const html = (status = 200, extra: Record<string, string> = {}) =>
  new Response('<html>page</html>', { status, headers: { 'content-type': 'text/html;charset=UTF-8', ...extra } });

function fakeCache() {
  const store = new Map<string, Response>();
  const cache: EdgeCache = {
    match: async (k) => store.get(k)?.clone(),
    put: async (k, r) => void store.set(k, r),
  };
  const pending: Promise<unknown>[] = [];
  return { store, cache, ctx: { waitUntil: (p: Promise<unknown>) => void pending.push(p) }, settle: () => Promise.all(pending) };
}

describe('isCacheablePage', () => {
  it('caches public pages', () => {
    for (const p of ['/', '/vendors?group=venues', '/guides/blog/qortsilis-biujeti', '/tamada/tbilisi/x-1', '/invitations', '/wedding']) {
      expect(isCacheablePage(new Request(B + p))).toBe(true);
    }
  });

  it('never caches personal or one-time links', () => {
    for (const p of ['/w/nino', '/w/nino/CODE', '/partner/tok', '/join', '/reset-password?token=x']) {
      expect(isCacheablePage(new Request(B + p))).toBe(false);
    }
  });

  it('only caches anonymous GETs', () => {
    expect(isCacheablePage(new Request(`${B}/`, { method: 'HEAD' }))).toBe(false);
    expect(isCacheablePage(new Request(`${B}/`, { method: 'POST' }))).toBe(false);
    expect(isCacheablePage(new Request(`${B}/`, { headers: { authorization: 'Bearer x' } }))).toBe(false);
  });
});

describe('edgeCacheKey', () => {
  it('drops the parameters social networks and ads add', () => {
    expect(edgeCacheKey(`${B}/vendors?fbclid=abc&group=photo&utm_source=ig&igsh=x`)).toBe(`${B}/vendors?group=photo`);
    expect(edgeCacheKey(`${B}/?fbclid=abc`)).toBe(`${B}/`);
    expect(edgeCacheKey(`${B}/tamada/tbilisi/x-1?igsh=1#reviews`)).toBe(`${B}/tamada/tbilisi/x-1`);
  });

  it('keeps what the pages read, in one order', () => {
    const a = edgeCacheKey(`${B}/vendors?region=kakheti&group=venues&q=${encodeURIComponent('ეზო')}`);
    const b = edgeCacheKey(`${B}/vendors?q=${encodeURIComponent('ეზო')}&group=venues&region=kakheti`);
    expect(a).toBe(b);
    expect(a).toContain('group=venues');
    expect(a).toContain('region=kakheti');
    expect(edgeCacheKey(`${B}/schedules?s=classic`)).toBe(`${B}/schedules?s=classic`);
    expect(edgeCacheKey(`${B}/guides/blog?topic=budget`)).toBe(`${B}/guides/blog?topic=budget`);
    expect(edgeCacheKey(`${B}/login?expired=1&returnUrl=%2Fplanning`)).not.toBe(edgeCacheKey(`${B}/login`));
  });
});

describe('withEdgeCache', () => {
  it('renders once, then serves the stored page without rendering', async () => {
    const { cache, ctx, settle, store } = fakeCache();
    const render = vi.fn(async () => html());
    const first = await withEdgeCache(new Request(`${B}/vendors`), cache, ctx, render);
    expect(first.headers.get('x-edge-cache')).toBe('MISS');
    expect(await first.text()).toContain('page');
    await settle();
    expect(store.get(`${B}/vendors`)?.headers.get('cache-control')).toBe(`public, max-age=${EDGE_CACHE_SECONDS}`);

    const second = await withEdgeCache(new Request(`${B}/vendors`), cache, ctx, render);
    expect(second.headers.get('x-edge-cache')).toBe('HIT');
    expect(await second.text()).toContain('page');
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('keeps the browser asking again, on a hit and a miss', async () => {
    const { cache, ctx, settle } = fakeCache();
    const render = async () => html();
    const miss = await withEdgeCache(new Request(`${B}/`), cache, ctx, render);
    await settle();
    const hit = await withEdgeCache(new Request(`${B}/`), cache, ctx, render);
    expect(miss.headers.get('cache-control')).toBe('no-cache');
    expect(hit.headers.get('cache-control')).toBe('no-cache');
  });

  it('keeps different queries apart', async () => {
    const { cache, ctx, settle } = fakeCache();
    const render = vi.fn(async () => html());
    await withEdgeCache(new Request(`${B}/vendors?group=photo`), cache, ctx, render);
    await settle();
    await withEdgeCache(new Request(`${B}/vendors?group=decor`), cache, ctx, render);
    expect(render).toHaveBeenCalledTimes(2);
  });

  it('serves one stored page to every tracking link', async () => {
    const { cache, ctx, settle } = fakeCache();
    const render = vi.fn(async () => html());
    await withEdgeCache(new Request(`${B}/vendors?group=photo&fbclid=one`), cache, ctx, render);
    await settle();
    const second = await withEdgeCache(new Request(`${B}/vendors?fbclid=two&group=photo`), cache, ctx, render);
    expect(second.headers.get('x-edge-cache')).toBe('HIT');
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('stores only successful HTML pages', async () => {
    const cases = [
      html(404),
      html(500),
      new Response(null, { status: 301, headers: { location: `${B}/` } }),
      new Response('{}', { headers: { 'content-type': 'application/json' } }),
      html(200, { 'set-cookie': 'a=b' }),
      html(200, { 'x-rendered-by-browser': '1' }),
    ];
    for (const res of cases) {
      const { cache, ctx, settle, store } = fakeCache();
      const out = await withEdgeCache(new Request(`${B}/x`), cache, ctx, async () => res);
      await settle();
      expect(store.size).toBe(0);
      expect(out.status).toBe(res.status);
    }
  });

  it('renders right past personal links', async () => {
    const { cache, ctx, settle, store } = fakeCache();
    const render = vi.fn(async () => html());
    await withEdgeCache(new Request(`${B}/w/nino/CODE`), cache, ctx, render);
    await settle();
    expect(store.size).toBe(0);
  });

  it('still renders when the cache fails', async () => {
    const ctx = { waitUntil: () => {} };
    const cache: EdgeCache = { match: () => Promise.reject(new Error('down')), put: () => Promise.reject(new Error('down')) };
    const res = await withEdgeCache(new Request(`${B}/`), cache, ctx, async () => html());
    expect(res.status).toBe(200);
  });
});

describe('browserRenderedShell', () => {
  it('serves the shell, marked so it is never stored', async () => {
    const seen: string[] = [];
    const res = await browserRenderedShell(new Request(`${B}/vendors?x=1`), {
      fetch: async (r) => (seen.push(r.url), html()),
    });
    expect(seen).toEqual([`${B}/index.csr`]);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-rendered-by-browser')).toBe('1');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('says so honestly when the shell is missing too', async () => {
    const res = await browserRenderedShell(new Request(`${B}/`), { fetch: async () => new Response('', { status: 404 }) });
    expect(res.status).toBe(503);
  });
});
