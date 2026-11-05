// Redirects the live site answers before Angular sees the request. Pure (no Angular imports) so
// server.redirects.spec.ts can test them; `wrangler dev` rewrites the host to 127.0.0.1, which
// makes the www rule impossible to observe locally.

/** The canonical host of the live site. */
export const APEX = 'weddingplanner.ge';

/** Article sections under /guides; anything else at /guides/<slug> is an old article URL. */
const GUIDE_SECTIONS = new Set(['blog', 'inspiration', 'real-weddings']);

/** A redirect response for `req`, or null when the request should be rendered. */
export function redirectFor(req: Request): Response | null {
  const url = new URL(req.url);

  // www → apex, permanently: one canonical host for search engines and shared links. The Host
  // header counts too, for proxies that keep the original host there.
  const host = req.headers.get('host')?.split(':')[0];
  if (url.hostname === `www.${APEX}` || host === `www.${APEX}`) {
    url.hostname = APEX;
    url.port = '';
    return Response.redirect(url.toString(), 301);
  }

  // Old article URLs (/guides/<slug>) moved to /guides/blog/<slug> (design-system/PROPOSALS.md
  // P11), same rule as the Express server.ts. Redirected so search engines carry the old URL's
  // standing over, and a missing article still ends as a plain 404 at its new address.
  const article = url.pathname.match(/^\/guides\/([^/]+)$/);
  if (article && !GUIDE_SECTIONS.has(article[1])) {
    url.pathname = `/guides/blog/${article[1]}`;
    return Response.redirect(url.toString(), 301);
  }

  return null;
}
