// Fills in what crawlers and link previews look for in a rendered page's <head>: the canonical address and
// the Open Graph and Twitter tags. Done here, on the finished HTML, so every page gets them whatever it set
// itself and whenever its data arrived; a page's own tags win. Pure, so server.head.spec.ts can test it.

export const ORIGIN = 'https://weddingplanner.ge';
const DEFAULT_IMAGE = `${ORIGIN}/media/og-default.jpg`;
const SITE = 'WeddingPlanner';

/** Who we are, on the home page, for search engines and AI assistants. */
const HOME_JSON_LD = JSON.stringify([
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${ORIGIN}/#organization`,
    name: SITE,
    url: `${ORIGIN}/`,
    logo: `${ORIGIN}/icon-512.png`,
    image: DEFAULT_IMAGE,
    email: 'info@weddingplanner.ge',
    description: 'ქართული პლატფორმა ქორწილის დასაგეგმად: უფასო ხელსაწყო წყვილებისთვის, საქორწილო სივრცეებისა და მომსახურებების კატალოგი და ონლაინ მოსაწვევები.',
    areaServed: { '@type': 'Country', name: 'Georgia' },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${ORIGIN}/#website`,
    name: SITE,
    alternateName: 'weddingplanner.ge',
    url: `${ORIGIN}/`,
    inLanguage: 'ka',
    publisher: { '@id': `${ORIGIN}/#organization` },
  },
]).replace(/</g, '\\u003C');

const attr = (s: string) => s.replace(/"/g, '&quot;');

function metaContent(head: string, kind: 'name' | 'property', key: string): string | null {
  const tag = head.match(new RegExp(`<meta\\b[^>]*\\b${kind}="${key}"[^>]*>`, 'i'))?.[0];
  return tag?.match(/\bcontent="([^"]*)"/i)?.[1] ?? null;
}

export function finishHead(html: string, requestUrl: string): string {
  const end = html.indexOf('</head>');
  if (end === -1) return html;
  let head = html.slice(0, end);
  const add: string[] = [];
  const { pathname } = new URL(requestUrl);
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : '/';
  const address = ORIGIN + path;
  const hidden = /noindex/i.test(metaContent(head, 'name', 'robots') ?? '');

  if (!hidden) {
    const canonical = head.match(/<link\b[^>]*\brel="canonical"[^>]*>/i)?.[0].match(/\bhref="([^"]*)"/i)?.[1];
    if (!canonical) add.push(`<link rel="canonical" href="${address}">`);
    // English is served on the same address (chosen by a cookie, not by the URL), so there is no
    // separate English page to name: Georgian and the default both point at the page itself.
    if (!/<link\b[^>]*\bhreflang=/i.test(head)) {
      const href = canonical ?? address;
      add.push(`<link rel="alternate" hreflang="ka" href="${href}">`, `<link rel="alternate" hreflang="x-default" href="${href}">`);
    }
  }

  const title = head.match(/<title>([\s\S]*?)<\/title>/i)?.[1].trim() ?? SITE;
  const description = metaContent(head, 'name', 'description');
  const own = (key: string) => metaContent(head, 'property', key) !== null;
  const og = (key: string, value: string | null) => {
    if (value && !own(key)) add.push(`<meta property="${key}" content="${attr(value)}">`);
  };
  og('og:site_name', SITE);
  og('og:locale', 'ka_GE');
  og('og:type', 'website');
  og('og:url', address);
  og('og:title', title.replace(/\s*\|\s*WeddingPlanner$/, ''));
  og('og:description', description);

  // an image has to be a full address to work in a link preview
  const image = metaContent(head, 'property', 'og:image');
  if (image?.startsWith('/')) {
    head = head.replace(`content="${image}"`, `content="${ORIGIN}${image}"`);
  } else if (!image) {
    add.push(
      `<meta property="og:image" content="${DEFAULT_IMAGE}">`,
      '<meta property="og:image:width" content="1200">',
      '<meta property="og:image:height" content="630">',
      '<meta property="og:image:alt" content="WeddingPlanner — დაგეგმე შენი ოცნების ქორწილი">',
    );
  }
  if (metaContent(head, 'name', 'twitter:card') === null) add.push('<meta name="twitter:card" content="summary_large_image">');

  // structured data: an image or a page named by its path gets the full address too
  head = head.replace(/"(image|url)":"\/(?!\/)/g, `"$1":"${ORIGIN}/`);
  if (path === '/') add.push(`<script type="application/ld+json">${HOME_JSON_LD}</script>`);

  return head + add.join('') + html.slice(end);
}

/**
 * Sent with every HTML page as a Link header, for crawlers and AI agents that read headers before
 * (or instead of) the page: where the sitemap is, and the plain-text description of the site.
 */
export const SITE_LINKS = '</sitemap.xml>; rel="sitemap", </llms.txt>; rel="describedby"; type="text/plain"';

/** The same, on a response: only for HTML pages. */
export async function withFinishedHead(res: Response, requestUrl: string): Promise<Response> {
  if (!(res.headers.get('content-type') ?? '').includes('text/html')) return res;
  const headers = new Headers(res.headers);
  headers.delete('content-length');
  headers.set('link', SITE_LINKS);
  return new Response(finishHead(await res.text(), requestUrl), { status: res.status, statusText: res.statusText, headers });
}
