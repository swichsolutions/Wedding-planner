import { describe, expect, it } from 'vitest';
import { articleAsMarkdown, isArticlePath } from './server.markdown';

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

describe('articleAsMarkdown', () => {
  it('answers an article with its title, text and address', async () => {
    const { calls, fetcher } = api(ARTICLE);
    const res = await articleAsMarkdown(ask('/rchevebi/blogi/qortsilis-biujeti'), API, fetcher);
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
    await articleAsMarkdown(ask('/rchevebi/shtagoneba/a'), API, fetcher);
    await articleAsMarkdown(ask('/rchevebi/realuri-qortsilebi/b/'), API, fetcher);
    expect(calls).toEqual([`${API}/api/content/inspiration/a`, `${API}/api/content/real-wedding/b`]);
  });

  it('leaves everything else to the HTML page', async () => {
    const { calls, fetcher } = api(ARTICLE);
    expect(await articleAsMarkdown(ask('/rchevebi/blogi/a', 'text/html'), API, fetcher)).toBeNull();
    expect(await articleAsMarkdown(ask('/rchevebi/blogi'), API, fetcher)).toBeNull();
    expect(await articleAsMarkdown(ask('/fotografi/tbilisi'), API, fetcher)).toBeNull();
    expect(await articleAsMarkdown(ask('/rchevebi/blogi/a', 'text/markdown', 'POST'), API, fetcher)).toBeNull();
    expect(calls).toEqual([]);
  });

  it('leaves a missing article and a failing API to the HTML page too', async () => {
    expect(await articleAsMarkdown(ask('/rchevebi/blogi/nope'), API, api({}, 404).fetcher)).toBeNull();
    const down = async () => {
      throw new Error('down');
    };
    expect(await articleAsMarkdown(ask('/rchevebi/blogi/a'), API, down)).toBeNull();
  });
});

describe('isArticlePath', () => {
  it('is true for one article only', () => {
    expect(isArticlePath('/rchevebi/blogi/a')).toBe(true);
    expect(isArticlePath('/rchevebi/blogi')).toBe(false);
    expect(isArticlePath('/rchevebi/blogi/a/b')).toBe(false);
    expect(isArticlePath('/vendors')).toBe(false);
  });
});
