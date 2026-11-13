// Pages as Markdown, for AI agents that ask for it (`Accept: text/markdown`): the same text the page
// shows, without the page around it. An article and a legal page come from what the API already
// returns for them (their bodies are written in Markdown); the home page is the site's summary
// (public/llms.txt, which is Markdown); a day schedule is built from core/day-schedules.ts. Anything
// else, and any failure, falls through to the normal HTML page, which answers 404 and 503 the way
// it does for everyone. Pure (no Angular), so the spec can test it and the Worker can load it.
import { ContentDetail, KIND_SECTION, LEGAL_SLUGS } from './app/core/content.models';
import { DAY_SCHEDULES, DaySchedule } from './app/core/day-schedules';
import { SCHEDULES_PATH, scheduleBySlug, schedulePath } from './app/core/schedule-addresses';
import { ORIGIN } from './server.head';

/** How long an edge or an agent may reuse the answer: the same as a rendered page. */
const MAX_AGE_SECONDS = 300;

type Fetcher = (url: string) => Promise<Response>;

/** What an address answers in Markdown, or null for one that has no Markdown form. */
type Source =
  | { kind: 'content'; type: string; slug: string; section: string }
  | { kind: 'home' }
  | { kind: 'schedules' }
  | { kind: 'schedule'; schedule: DaySchedule };

function sourceAt(pathname: string): Source | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (path === '/') return { kind: 'home' };
  if (path === SCHEDULES_PATH) return { kind: 'schedules' };
  if (path.startsWith(`${SCHEDULES_PATH}/`)) {
    const key = scheduleBySlug(path.slice(SCHEDULES_PATH.length + 1));
    const schedule = DAY_SCHEDULES.find((s) => s.key === key);
    return schedule ? { kind: 'schedule', schedule } : null;
  }
  // the legal pages live at the top level (/terms, /privacy)
  const legal = path.slice(1);
  if (LEGAL_SLUGS.includes(legal)) return { kind: 'content', type: 'legal', slug: legal, section: '' };
  for (const [type, section] of Object.entries(KIND_SECTION)) {
    const slug = path.startsWith(`${section}/`) ? path.slice(section.length + 1) : '';
    if (slug && !slug.includes('/')) return { kind: 'content', type, slug, section };
  }
  return null;
}

/** True where the address answers in two forms (caches must keep them apart: Vary: Accept). */
export const hasMarkdown = (pathname: string): boolean => sourceAt(pathname) !== null;

/** One example day as Markdown: its name, what it is, the moments with their times, the note. */
export function scheduleMarkdown(s: DaySchedule): string {
  const cell = (text: string | undefined) => (text ?? '').replace(/\|/g, '\\|');
  const rows = s.rows.map((r) => `| ${r.time} | ${cell(r.activity.ka)} | ${cell(r.note?.ka)} | ${cell(r.who?.ka)} |`);
  return [
    `# ${s.title.ka}`,
    s.summary.ka,
    ['| დრო | აქტივობა | შენიშვნა | ვინ |', '| --- | --- | --- | --- |', ...rows].join('\n'),
    s.note?.ka ?? '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** /ganrigebi: the three examples, each with its own page. */
function schedulesMarkdown(): string {
  return [
    '# ქორწილის დღის განრიგები',
    ...DAY_SCHEDULES.map((s) => `## [${s.title.ka}](${ORIGIN}${schedulePath(s.key)})\n\n${s.summary.ka}`),
  ].join('\n\n');
}

async function contentMarkdown(at: { type: string; slug: string; section: string }, apiOrigin: string, fetcher: Fetcher) {
  const res = await fetcher(`${apiOrigin}/api/content/${at.type}/${at.slug}`);
  if (!res.ok) return null;
  const page = (await res.json()) as ContentDetail;
  return {
    text: [`# ${page.summary.titleKa}`, page.summary.excerptKa, page.bodyKa].filter(Boolean).join('\n\n'),
    path: `${at.section}/${page.summary.slug}`,
  };
}

/**
 * The Markdown answer to `req`, or null when the HTML page should answer. `asset` reads one of
 * the site's own files (the Worker's static assets): the home page's text is public/llms.txt.
 */
export async function pageAsMarkdown(
  req: Request,
  apiOrigin: string,
  fetcher: Fetcher = (url) => fetch(url),
  asset: Fetcher = fetcher,
): Promise<Response | null> {
  if (req.method !== 'GET' || !/\btext\/markdown\b/i.test(req.headers.get('accept') ?? '')) return null;
  const at = sourceAt(new URL(req.url).pathname);
  if (!at) return null;

  try {
    let answer: { text: string; path: string } | null;
    if (at.kind === 'home') {
      const res = await asset(`${new URL(req.url).origin}/llms.txt`);
      answer = res.ok ? { text: (await res.text()).trim(), path: '/' } : null;
    } else if (at.kind === 'schedules') {
      answer = { text: schedulesMarkdown(), path: SCHEDULES_PATH };
    } else if (at.kind === 'schedule') {
      answer = { text: scheduleMarkdown(at.schedule), path: schedulePath(at.schedule.key) };
    } else {
      answer = await contentMarkdown(at, apiOrigin, fetcher);
    }
    if (!answer) return null;

    const address = ORIGIN + answer.path;
    return new Response(`${answer.text}\n\n[${address}](${address})\n`, {
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
