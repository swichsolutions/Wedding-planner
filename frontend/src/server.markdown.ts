// An article as Markdown, for AI agents that ask for it (`Accept: text/markdown`): the same text the
// page shows, without the page around it. Built from what the API already returns for the article
// (its body is written in Markdown). Anything else, and any failure, falls through to the normal
// HTML page, which answers 404 and 503 the way it does for everyone. Pure, so the spec can test it.
import { ContentDetail, KIND_SECTION } from './app/core/content.models';
import { ORIGIN } from './server.head';

/** How long an edge or an agent may reuse the answer: the same as a rendered page. */
const MAX_AGE_SECONDS = 300;

/** "/rchevebi/blogi/<slug>" → the API's kind and the slug; null for any other address. */
function articleAt(pathname: string): { kind: string; slug: string } | null {
  for (const [kind, section] of Object.entries(KIND_SECTION)) {
    const slug = pathname.startsWith(`${section}/`) ? pathname.slice(section.length + 1).replace(/\/+$/, '') : '';
    if (slug && !slug.includes('/')) return { kind, slug };
  }
  return null;
}

export const isArticlePath = (pathname: string): boolean => articleAt(pathname) !== null;

export async function articleAsMarkdown(
  req: Request,
  apiOrigin: string,
  fetcher: (url: string) => Promise<Response> = (url) => fetch(url),
): Promise<Response | null> {
  if (req.method !== 'GET' || !/\btext\/markdown\b/i.test(req.headers.get('accept') ?? '')) return null;
  const at = articleAt(new URL(req.url).pathname);
  if (!at) return null;

  try {
    const res = await fetcher(`${apiOrigin}/api/content/${at.kind}/${at.slug}`);
    if (!res.ok) return null;
    const page = (await res.json()) as ContentDetail;
    const address = `${ORIGIN}${KIND_SECTION[at.kind as keyof typeof KIND_SECTION]}/${page.summary.slug}`;
    const text = [`# ${page.summary.titleKa}`, page.summary.excerptKa, page.bodyKa, `[${address}](${address})`]
      .filter(Boolean)
      .join('\n\n');
    return new Response(`${text}\n`, {
      headers: {
        'content-type': 'text/markdown; charset=utf-8',
        // the same address answers with HTML to everyone else
        vary: 'Accept',
        link: `<${address}>; rel="canonical"`,
        'cache-control': `public, max-age=${MAX_AGE_SECONDS}`,
      },
    });
  } catch {
    return null;
  }
}
