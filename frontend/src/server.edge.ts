// What keeps server-rendered pages cheap and up on the Cloudflare Worker. A render costs 45–120 ms of
// CPU, more than the Workers free plan allows per request: Cloudflare tolerates that now and then, but a
// burst (a crawler, a shared link) gets requests killed with error 1102. So a public page is rendered
// once and served from the edge for a few minutes. Pure, so server.edge.spec.ts can test it.

/** How long a rendered page is reused. Also how long an edit can take to show to first-time loads. */
export const EDGE_CACHE_SECONDS = 300;

/** Pages that must stay per-visitor or fresh: personal invitation links and one-time token links. */
const NEVER_CACHED = [/^\/w(\/|$)/, /^\/partner(\/|$)/, /^\/join(\/|$)/, /^\/reset-password(\/|$)/];

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

  const key = req.url;
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
