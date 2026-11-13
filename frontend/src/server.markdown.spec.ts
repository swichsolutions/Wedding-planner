import { describe, expect, it } from 'vitest';
import { hasMarkdown, pageAsMarkdown } from './server.markdown';

const B = 'https://weddingplanner.ge';
const API = 'https://api.example';
const ARTICLE = { summary: { slug: 'qortsilis-biujeti', titleKa: 'ქორწილის ბიუჯეტი', excerptKa: 'მოკლედ.' }, bodyKa: '## ნაწილი\n\nტექსტი.' };
const ask = (path: string, accept = 'text/markdown, text/html;q=0.8', method = 'GET') =>
  new Request(B + path, { method, headers: { accept } });
const api = (body: unknown, status = 200) => {
  const calls: string[] = [];
  const fetcher = async (url: string) => {
    calls.push(url);
    return new Response(JSON.stringify(body), { status });
  };
  return { calls, fetcher };
};

describe('pageAsMarkdown', () => {
  it('answers an article with its title, text and address', async () => {
    const { calls, fetcher } = api(ARTICLE);
    const res = await pageAsMarkdown(ask('/rchevebi/blogi/qortsilis-biujeti'), API, fetcher);
    expect(calls).toEqual([`${API}/api/content/article/qortsilis-biujeti`]);
    expect(res!.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
    expect(res!.headers.get('vary')).toBe('Accept');
    expect(res!.headers.get('link')).toBe(`<${B}/rchevebi/blogi/qortsilis-biujeti>; rel="canonical"`);
    expect(await res!.text()).toBe(
      `# ქორწილის ბიუჯეტი\n\nმოკლედ.\n\n## ნაწილი\n\nტექსტი.\n\n[${B}/rchevebi/blogi/qortsilis-biujeti](${B}/rchevebi/blogi/qortsilis-biujeti)\n`,
    );
  });

  it('knows the other two sections', async () => {
    const { calls, fetcher } = api(ARTICLE);
    await pageAsMarkdown(ask('/rchevebi/shtagoneba/a'), API, fetcher);
    await pageAsMarkdown(ask('/rchevebi/realuri-qortsilebi/b/'), API, fetcher);
    expect(calls).toEqual([`${API}/api/content/inspiration/a`, `${API}/api/content/real-wedding/b`]);
  });

  it('answers the legal pages from the API, at their own addresses', async () => {
    const { calls, fetcher } = api({ summary: { slug: 'terms', titleKa: 'წესები', excerptKa: null }, bodyKa: 'ტექსტი.' });
    const res = await pageAsMarkdown(ask('/terms'), API, fetcher);
    expect(calls).toEqual([`${API}/api/content/legal/terms`]);
    expect(await res!.text()).toBe(`# წესები\n\nტექსტი.\n\n[${B}/terms](${B}/terms)\n`);
    await pageAsMarkdown(ask('/privacy'), API, fetcher);
    expect(calls[1]).toBe(`${API}/api/content/legal/privacy`);
  });

  it('answers the home page with the site summary (llms.txt)', async () => {
    const files: string[] = [];
    const asset = async (url: string) => (files.push(url), new Response('# WeddingPlanner\n\n> რა არის.\n'));
    const res = await pageAsMarkdown(ask('/'), API, api({}).fetcher, asset);
    expect(files).toEqual([`${B}/llms.txt`]);
    expect(res!.headers.get('link')).toBe(`<${B}/>; rel="canonical"`);
    expect(await res!.text()).toBe(`# WeddingPlanner\n\n> რა არის.\n\n[${B}/](${B}/)\n`);
  });

  it('answers a day schedule with its moments, and the schedules page with the three', async () => {
    const { calls, fetcher } = api({});
    const day = await (await pageAsMarkdown(ask('/ganrigebi/jvristsera'), API, fetcher))!.text();
    expect(day.startsWith('# ჯვრისწერა + წვეულება\n\n')).toBe(true);
    expect(day).toContain('| დრო | აქტივობა | შენიშვნა | ვინ |');
    expect(day).toContain('| 14:00 | ჯვრისწერა |');
    expect(day).toContain(`[${B}/ganrigebi/jvristsera](${B}/ganrigebi/jvristsera)`);
    const all = await (await pageAsMarkdown(ask('/ganrigebi/'), API, fetcher))!.text();
    expect(all).toContain(`## [მხოლოდ წვეულება](${B}/ganrigebi/mkholod-tsveuleba)`);
    expect(calls).toEqual([]);
    expect(await pageAsMarkdown(ask('/ganrigebi/zzz'), API, fetcher)).toBeNull();
  });

  it('leaves everything else to the HTML page', async () => {
    const { calls, fetcher } = api(ARTICLE);
    expect(await pageAsMarkdown(ask('/rchevebi/blogi/a', 'text/html'), API, fetcher)).toBeNull();
    expect(await pageAsMarkdown(ask('/rchevebi/blogi'), API, fetcher)).toBeNull();
    expect(await pageAsMarkdown(ask('/fotografi/tbilisi'), API, fetcher)).toBeNull();
    expect(await pageAsMarkdown(ask('/rchevebi/blogi/a', 'text/markdown', 'POST'), API, fetcher)).toBeNull();
    expect(calls).toEqual([]);
  });

  it('leaves a missing page and a failing API or file to the HTML page too', async () => {
    expect(await pageAsMarkdown(ask('/rchevebi/blogi/nope'), API, api({}, 404).fetcher)).toBeNull();
    const down = async (): Promise<Response> => {
      throw new Error('down');
    };
    expect(await pageAsMarkdown(ask('/rchevebi/blogi/a'), API, down)).toBeNull();
    expect(await pageAsMarkdown(ask('/'), API, down, async () => new Response('', { status: 404 }))).toBeNull();
  });
});

describe('hasMarkdown', () => {
  it('is true for the pages with a Markdown form only', () => {
    for (const path of ['/', '/rchevebi/blogi/a', '/terms', '/privacy', '/ganrigebi', '/ganrigebi/khelis-motsera']) {
      expect(hasMarkdown(path)).toBe(true);
    }
    for (const path of ['/rchevebi/blogi', '/rchevebi/blogi/a/b', '/vendors', '/ganrigebi/zzz', '/about']) {
      expect(hasMarkdown(path)).toBe(false);
    }
  });
});
