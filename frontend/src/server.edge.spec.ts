import { describe, expect, it, vi } from 'vitest';
import {
  EDGE_CACHE_SECONDS,
  EDGE_KEEP_SECONDS,
  EdgeCache,
  SITEMAP_CACHE_SECONDS,
  browserRenderedShell,
  edgeCacheKey,
  isCacheablePage,
  sitemapFromApi,
  storedPageState,
  withEdgeCache,
} from './server.edge';

const B = 'https://weddingplanner.ge';
const html = (status = 200, extra: Record<string, string> = {}, body = '<html>page</html>') =>
  new Response(body, { status, headers: { 'content-type': 'text/html;charset=UTF-8', ...extra } });

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
    for (const p of ['/', '/sivrtseebi-da-kveba', '/fotografi?region=kakheti', '/rchevebi/blogi/qortsilis-biujeti', '/ganrigebi/jvristsera', '/tamada/tbilisi/x-1', '/invitations', '/wedding']) {
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
    expect(edgeCacheKey(`${B}/fotografi?fbclid=abc&region=kakheti&utm_source=ig&igsh=x`)).toBe(`${B}/fotografi?region=kakheti`);
    expect(edgeCacheKey(`${B}/?fbclid=abc`)).toBe(`${B}/`);
    expect(edgeCacheKey(`${B}/tamada/tbilisi/x-1?igsh=1#reviews`)).toBe(`${B}/tamada/tbilisi/x-1`);
  });

  it('keeps what the pages read, in one order', () => {
    const a = edgeCacheKey(`${B}/darbazi?region=kakheti&guests=200&q=${encodeURIComponent('ეზო')}`);
    const b = edgeCacheKey(`${B}/darbazi?q=${encodeURIComponent('ეზო')}&guests=200&region=kakheti`);
    expect(a).toBe(b);
    expect(a).toContain('guests=200');
    expect(a).toContain('region=kakheti');
    expect(edgeCacheKey(`${B}/rchevebi/blogi?topic=budget`)).toBe(`${B}/rchevebi/blogi?topic=budget`);
    // an old ?group= that names nothing is still read by the catalog (a known one is redirected)
    expect(edgeCacheKey(`${B}/vendors?group=zzz`)).toBe(`${B}/vendors?group=zzz`);
    // each schedule has its own path now: nothing reads ?s= any more
    expect(edgeCacheKey(`${B}/ganrigebi/jvristsera?s=one-venue`)).toBe(`${B}/ganrigebi/jvristsera`);
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
    // kept for a day; how long it is served without a new render is decided from its age
    expect(store.get(`${B}/vendors`)?.headers.get('cache-control')).toBe(`public, max-age=${EDGE_KEEP_SECONDS}`);

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
    await withEdgeCache(new Request(`${B}/fotografi?region=kakheti`), cache, ctx, render);
    await settle();
    await withEdgeCache(new Request(`${B}/fotografi?region=imereti`), cache, ctx, render);
    expect(render).toHaveBeenCalledTimes(2);
  });

  it('serves one stored page to every tracking link', async () => {
    const { cache, ctx, settle } = fakeCache();
    const render = vi.fn(async () => html());
    await withEdgeCache(new Request(`${B}/foto-da-video?fbclid=one`), cache, ctx, render);
    await settle();
    const second = await withEdgeCache(new Request(`${B}/foto-da-video?fbclid=two`), cache, ctx, render);
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

describe('storedPageState', () => {
  const T = 1_800_000_000_000;
  const after = (seconds: number) => T + seconds * 1000;

  it('is fresh for the first minutes', () => {
    expect(storedPageState(String(T), T)).toBe('fresh');
    expect(storedPageState(String(T), after(EDGE_CACHE_SECONDS))).toBe('fresh');
  });

  it('is stale from then on, for a day', () => {
    expect(storedPageState(String(T), after(EDGE_CACHE_SECONDS + 1))).toBe('stale');
    expect(storedPageState(String(T), after(3600))).toBe('stale');
    expect(storedPageState(String(T), after(EDGE_KEEP_SECONDS))).toBe('stale');
  });

  it('is not used after a day', () => {
    expect(storedPageState(String(T), after(EDGE_KEEP_SECONDS + 1))).toBe('expired');
  });

  it('treats a copy with no usable time as stale: served, and rendered again', () => {
    for (const at of [null, '', ' ', 'yesterday', 'NaN']) expect(storedPageState(at, T)).toBe('stale');
    // rendered "in the future": a clock moved
    expect(storedPageState(String(after(60)), T)).toBe('stale');
  });
});

describe('withEdgeCache, past the fresh window', () => {
  const T = 1_800_000_000_000;
  const MIN = 60_000;

  /** A cache, a clock, and a render that answers "v1", "v2"… */
  function setup() {
    const c = fakeCache();
    let time = T;
    let version = 0;
    const render = vi.fn(async () => html(200, {}, `<html>v${++version}</html>`));
    const ask = (path = '/vendors') => withEdgeCache(new Request(B + path), c.cache, c.ctx, render, () => time);
    return { ...c, render, ask, at: (ms: number) => void (time = T + ms) };
  }

  it('serves the stored page at once and renders a new one for the next visitor', async () => {
    const { ask, at, render, settle } = setup();
    await ask();
    await settle();

    at(10 * MIN);
    const stale = await ask();
    expect(stale.headers.get('x-edge-cache')).toBe('STALE');
    expect(await stale.text()).toContain('v1');
    await settle();
    expect(render).toHaveBeenCalledTimes(2);

    at(10 * MIN + 1000);
    const next = await ask();
    expect(next.headers.get('x-edge-cache')).toBe('HIT');
    expect(await next.text()).toContain('v2');
    expect(render).toHaveBeenCalledTimes(2);
  });

  it('answers before the new render has finished', async () => {
    const c = fakeCache();
    let time = T;
    let finish = () => {};
    const render = vi.fn(async () => html());
    await withEdgeCache(new Request(`${B}/`), c.cache, c.ctx, render, () => time);
    await c.settle();

    time = T + 10 * MIN;
    const slow = vi.fn(() => new Promise<Response>((resolve) => (finish = () => resolve(html(200, {}, '<html>new</html>')))));
    const res = await withEdgeCache(new Request(`${B}/`), c.cache, c.ctx, slow, () => time);
    expect(res.headers.get('x-edge-cache')).toBe('STALE');
    expect(slow).toHaveBeenCalledTimes(1);

    // a second visitor meanwhile gets the stored page too, and no second render is started
    const again = await withEdgeCache(new Request(`${B}/?fbclid=x`), c.cache, c.ctx, slow, () => time);
    expect(again.headers.get('x-edge-cache')).toBe('STALE');
    expect(slow).toHaveBeenCalledTimes(1);

    finish();
    await c.settle();
    expect(await c.store.get(`${B}/`)?.clone().text()).toContain('new');
  });

  it('keeps the stored page when the new render fails', async () => {
    for (const failure of [async () => html(500), async () => html(200, { 'x-rendered-by-browser': '1' }), () => Promise.reject(new Error('boom'))]) {
      const c = fakeCache();
      let time = T;
      await withEdgeCache(new Request(`${B}/x`), c.cache, c.ctx, async () => html(), () => time);
      await c.settle();

      time = T + 10 * MIN;
      const res = await withEdgeCache(new Request(`${B}/x`), c.cache, c.ctx, failure, () => time);
      await c.settle();
      expect(res.status).toBe(200);
      expect(await res.text()).toContain('page');
      expect(await c.store.get(`${B}/x`)?.clone().text()).toContain('page');

      // and the next visitor's request tries again
      const retry = vi.fn(async () => html(200, {}, '<html>back</html>'));
      await withEdgeCache(new Request(`${B}/x`), c.cache, c.ctx, retry, () => time);
      await c.settle();
      expect(retry).toHaveBeenCalledTimes(1);
      expect(await c.store.get(`${B}/x`)?.clone().text()).toContain('back');
    }
  });

  it('renders while the visitor waits once the stored page is a day old', async () => {
    const { ask, at, render, settle } = setup();
    await ask();
    await settle();

    at(EDGE_KEEP_SECONDS * 1000 + 1000);
    const res = await ask();
    expect(res.headers.get('x-edge-cache')).toBe('MISS');
    expect(await res.text()).toContain('v2');
    expect(render).toHaveBeenCalledTimes(2);
  });

  it('never shows a visitor when the page was rendered', async () => {
    const { ask, at, settle, store } = setup();
    const miss = await ask();
    await settle();
    const hit = await ask();
    at(10 * MIN);
    const stale = await ask();
    await settle();
    for (const res of [miss, hit, stale]) expect(res.headers.has('x-edge-rendered-at')).toBe(false);
    expect(store.get(`${B}/vendors`)?.headers.get('x-edge-rendered-at')).toBe(String(T + 10 * MIN));
  });

  it('never serves a page stored by an earlier deploy, however young (its script files are gone)', async () => {
    const c = fakeCache();
    let version = 0;
    const render = vi.fn(async () => html(200, {}, `<html>v${++version}</html>`));
    const ask = (build?: string) => withEdgeCache(new Request(`${B}/vendors`), c.cache, c.ctx, render, () => T, build);

    await ask('deploy-1');
    await c.settle();
    const same = await ask('deploy-1');
    expect(same.headers.get('x-edge-cache')).toBe('HIT');
    expect(same.headers.has('x-edge-build')).toBe(false);

    const next = await ask('deploy-2');
    expect(next.headers.get('x-edge-cache')).toBe('MISS');
    expect(await next.text()).toContain('v2');
    await c.settle();
    expect(c.store.get(`${B}/vendors`)?.headers.get('x-edge-build')).toBe('deploy-2');
    expect((await ask('deploy-2')).headers.get('x-edge-cache')).toBe('HIT');
    // a copy stored before builds were recorded counts as another deploy's
    c.store.get(`${B}/vendors`)?.headers.delete('x-edge-build');
    expect((await ask('deploy-2')).headers.get('x-edge-cache')).toBe('MISS');
  });
});

describe('sitemapFromApi', () => {
  const API = 'https://api.weddingplanner.ge';
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset><url><loc>${B}/</loc></url></urlset>`;

  it('serves the API\'s sitemap from the site\'s own address, as XML', async () => {
    const { cache, ctx } = fakeCache();
    const asked: string[] = [];
    const res = await sitemapFromApi(new Request(`${B}/sitemap.xml`), API, cache, ctx, async (url) => {
      asked.push(url);
      return new Response(xml, { headers: { 'content-type': 'application/xml' } });
    });
    expect(asked).toEqual([`${API}/sitemap.xml`]);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/xml');
    expect(res.headers.get('cache-control')).toBe(`public, max-age=${SITEMAP_CACHE_SECONDS}`);
    expect(await res.text()).toBe(xml);
  });

  it('asks the API once and reuses the answer', async () => {
    const { cache, ctx, settle } = fakeCache();
    const fetcher = vi.fn(async () => new Response(xml));
    await sitemapFromApi(new Request(`${B}/sitemap.xml`), API, cache, ctx, fetcher);
    await settle();
    const second = await sitemapFromApi(new Request(`${B}/sitemap.xml?x=1`), API, cache, ctx, fetcher);
    expect(await second.text()).toBe(xml);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('answers 503, and stores nothing, when the API fails or is unreachable', async () => {
    for (const fetcher of [async () => new Response('down', { status: 502 }), async () => Promise.reject(new Error('offline'))]) {
      const { cache, ctx, settle, store } = fakeCache();
      const res = await sitemapFromApi(new Request(`${B}/sitemap.xml`), API, cache, ctx, fetcher);
      await settle();
      expect(res.status).toBe(503);
      expect(res.headers.get('retry-after')).toBe('300');
      expect(store.size).toBe(0);
    }
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
