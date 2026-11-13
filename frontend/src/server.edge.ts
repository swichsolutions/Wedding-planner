// What keeps server-rendered pages cheap and up on the Cloudflare Worker. A render costs 45–120 ms of
// CPU, more than the Workers free plan allows per request: Cloudflare tolerates that now and then, but a
// burst (a crawler, a shared link) gets requests killed with error 1102. So a public page is rendered
// once and served from the edge for a few minutes. Pure, so server.edge.spec.ts can test it.

/** How long a rendered page is reused. Also how long an edit can take to show to first-time loads. */
export const EDGE_CACHE_SECONDS = 300;

/** Pages that must stay per-visitor or fresh: personal invitation links and one-time token links. */
const NEVER_CACHED = [/^\/w(\/|$)/, /^\/partner(\/|$)/, /^\/join(\/|$)/, /^\/reset-password(\/|$)/];

/**
 * The query parameters a page can read (grep the app for queryParamMap): the catalog's filters,
 * the topic picker, the budget's view, and the sign-in pages' returnUrl / expired
 * (they change the words on the page). Nothing else can change what is rendered, so nothing
 * else is part of the cache key: a link shared on Facebook or Instagram arrives with its own
 * ?fbclid=… / ?igsh=… / utm_* on every click, and each one used to be rendered again.
 * (uid and token belong to /reset-password, which is never cached.) A page that starts reading
 * a new parameter must add it here, or its variants will share one stored copy.
 */
const PAGE_PARAMS = new Set([
  'group', 'category', 'city', 'region', 'maxPrice', 'styles', 'guests', 'setting', 'venueType',
  // the catalog (/vendors, /<group>, /<category>). A group and a category are in the path since
  // 2026-11-13 and a known ?group= / ?category= is redirected there, but the page still reads
  // the two for values that name nothing, so they stay in the key. (/schedules?s= is gone: each
  // schedule has its own path.)
  'features', 'q', 'sort', 'vip',
  'topic', // /rchevebi/…
  'view', // /budget
  'returnUrl', 'expired', // /login, /signup, /planning/start
  'tab', 'use', 'step', // dashboard, admin and organizer pages (rendered signed-out on the server)
]);

/** Where a page is stored: its address with only the parameters it reads, in a fixed order. */
export function edgeCacheKey(url: string): string {
  const { origin, pathname, searchParams } = new URL(url);
  const kept = [...searchParams].filter(([name]) => PAGE_PARAMS.has(name));
  kept.sort(([a, x], [b, y]) => (a === b ? (x < y ? -1 : x > y ? 1 : 0) : a < b ? -1 : 1));
  const query = new URLSearchParams(kept).toString();
  return origin + pathname + (query ? `?${query}` : '');
}

export interface EdgeCache {
  match(key: string): Promise<Response | undefined>;
  put(key: string, res: Response): Promise<void>;
}

export interface EdgeContext {
  waitUntil(p: Promise<unknown>): void;
}

export function isCacheablePage(req: Request): boolean {
  if (req.method !== 'GET' || req.headers.has('authorization')) return false;
  const { pathname } = new URL(req.url);
  return !NEVER_CACHED.some((re) => re.test(pathname));
}

/** Serves `req` from the edge, or renders it and stores a successful page for next time. */
export async function withEdgeCache(
  req: Request,
  cache: EdgeCache,
  ctx: EdgeContext,
  render: () => Promise<Response>,
): Promise<Response> {
  if (!isCacheablePage(req)) return render();

  const key = edgeCacheKey(req.url);
  const hit = await cache.match(key).catch(() => undefined);
  if (hit) return forVisitor(hit, 'HIT');

  const res = await render();
  if (!canStore(res)) return res;

  const stored = new Response(res.clone().body, res);
  stored.headers.set('cache-control', `public, max-age=${EDGE_CACHE_SECONDS}`);
  ctx.waitUntil(cache.put(key, stored).catch(() => undefined));
  return forVisitor(res, 'MISS');
}

function canStore(res: Response): boolean {
  return (
    res.status === 200 &&
    (res.headers.get('content-type') ?? '').includes('text/html') &&
    !res.headers.has('set-cookie') &&
    !res.headers.has('x-rendered-by-browser')
  );
}

/** The browser always asks again, so only the edge holds on to a page. */
function forVisitor(res: Response, state: 'HIT' | 'MISS'): Response {
  const out = new Response(res.body, res);
  out.headers.set('cache-control', 'no-cache');
  out.headers.set('x-edge-cache', state);
  return out;
}

/** How long the sitemap is reused: the API builds it from the database on every request. */
export const SITEMAP_CACHE_SECONDS = 600;

/**
 * /sitemap.xml on the site's own domain (robots.txt points here). The API generates it
 * (SitemapController, with weddingplanner.ge addresses), but search engines expect a site's
 * sitemap on the site itself. Fetched from the API and kept at the edge for a few minutes. When
 * the API can't be reached the answer is a 503, which tells a crawler to come back later; never
 * an empty sitemap, which would tell it the pages are gone.
 */
export async function sitemapFromApi(
  req: Request,
  apiOrigin: string,
  cache: EdgeCache,
  ctx: EdgeContext,
  fetcher: (url: string) => Promise<Response> = (url) => fetch(url),
): Promise<Response> {
  const key = new URL('/sitemap.xml', req.url).toString();
  const hit = await cache.match(key).catch(() => undefined);
  if (hit) return hit;

  try {
    const res = await fetcher(`${apiOrigin}/sitemap.xml`);
    if (!res.ok) throw new Error(`the API answered ${res.status}`);
    const out = new Response(await res.text(), {
      headers: {
        'content-type': 'application/xml; charset=utf-8',
        'cache-control': `public, max-age=${SITEMAP_CACHE_SECONDS}`,
      },
    });
    ctx.waitUntil(cache.put(key, out.clone()).catch(() => undefined));
    return out;
  } catch (err) {
    console.error('The sitemap could not be fetched from the API.', err);
    return new Response('Sitemap temporarily unavailable', {
      status: 503,
      headers: { 'retry-after': '300', 'cache-control': 'no-store' },
    });
  }
}

/**
 * The fallback when a server render fails: the app's empty shell, which then renders in the browser.
 * A visitor gets a working page instead of an error, and it's never stored at the edge.
 */
export async function browserRenderedShell(req: Request, assets: { fetch(req: Request): Promise<Response> }): Promise<Response> {
  const res = await assets.fetch(new Request(new URL('/index.csr', req.url)));
  const out = new Response(res.body, { status: res.ok ? 200 : 503, headers: res.headers });
  out.headers.set('cache-control', 'no-store');
  out.headers.set('x-rendered-by-browser', '1');
  return out;
}
