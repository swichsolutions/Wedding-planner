import { describe, expect, it } from 'vitest';
import { finishHead, withFinishedHead } from './server.head';

const B = 'https://weddingplanner.ge';
const page = (head: string) => `<!doctype html><html><head>${head}</head><body><h1>x</h1></body></html>`;
const TITLE = '<title>ბლოგი | WeddingPlanner</title><meta name="description" content="აღწერა">';
const count = (html: string, s: string) => html.split(s).length - 1;

describe('finishHead', () => {
  it('adds the canonical address, without the query or a trailing slash', () => {
    expect(finishHead(page(TITLE), `${B}/vendors/?group=photo&x=1`)).toContain(`<link rel="canonical" href="${B}/vendors">`);
    expect(finishHead(page(TITLE), `${B}/`)).toContain(`<link rel="canonical" href="${B}/">`);
  });

  it('uses the live address on any host', () => {
    expect(finishHead(page(TITLE), 'http://localhost:8799/about')).toContain(`href="${B}/about"`);
  });

  it('keeps a page\'s own canonical', () => {
    const html = finishHead(page(`${TITLE}<link rel="canonical" href="${B}/own">`), `${B}/other`);
    expect(count(html, 'rel="canonical"')).toBe(1);
    expect(html).toContain(`href="${B}/own"`);
  });

  it('gives noindex pages no canonical', () => {
    const html = finishHead(page(`${TITLE}<meta name="robots" content="noindex">`), `${B}/signup`);
    expect(html).not.toContain('rel="canonical"');
  });

  it('fills link previews from the page\'s title and description', () => {
    const html = finishHead(page(TITLE), `${B}/guides/blog`);
    expect(html).toContain('<meta property="og:title" content="ბლოგი">');
    expect(html).toContain('<meta property="og:description" content="აღწერა">');
    expect(html).toContain(`<meta property="og:url" content="${B}/guides/blog">`);
    expect(html).toContain('<meta property="og:type" content="website">');
    expect(html).toContain('<meta property="og:site_name" content="WeddingPlanner">');
    expect(html).toContain(`<meta property="og:image" content="${B}/media/og-default.jpg">`);
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
  });

  it('keeps tags a page set itself, and makes a relative image absolute', () => {
    const html = finishHead(
      page(`${TITLE}<meta property="og:title" content="საკუთარი"><meta property="og:type" content="article"><meta property="og:image" content="/media/x.webp">`),
      `${B}/guides/blog/a`,
    );
    expect(count(html, 'property="og:title"')).toBe(1);
    expect(html).toContain('content="საკუთარი"');
    expect(html).toContain('<meta property="og:type" content="article">');
    expect(html).toContain(`<meta property="og:image" content="${B}/media/x.webp">`);
    expect(html).not.toContain('og-default.jpg');
  });

  it('keeps a full image address as it is', () => {
    const url = 'https://res.cloudinary.com/x/y.jpg';
    expect(finishHead(page(`${TITLE}<meta property="og:image" content="${url}">`), `${B}/a`)).toContain(`content="${url}"`);
  });

  it('makes a relative image in structured data absolute', () => {
    const html = finishHead(page(`${TITLE}<script type="application/ld+json">{"image":"/media/x.webp"}</script>`), `${B}/a`);
    expect(html).toContain(`{"image":"${B}/media/x.webp"}`);
  });

  it('escapes quotes from a title into the attribute', () => {
    expect(finishHead(page('<title>„a" b</title>'), `${B}/a`)).toContain('content="„a&quot; b"');
  });

  it('says who we are on the home page only', () => {
    const home = finishHead(page(TITLE), `${B}/`);
    expect(home).toContain('"@type":"Organization"');
    expect(home).toContain('"@type":"WebSite"');
    expect(finishHead(page(TITLE), `${B}/about`)).not.toContain('"@type":"Organization"');
    const ld = home.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1];
    expect(JSON.parse(ld)).toHaveLength(2);
  });

  it('adds everything inside the head and leaves the body alone', () => {
    const html = finishHead(page(TITLE), `${B}/`);
    expect(html.indexOf('rel="canonical"')).toBeLessThan(html.indexOf('</head>'));
    expect(html).toContain('<body><h1>x</h1></body>');
  });

  it('leaves a page without a head alone', () => {
    expect(finishHead('plain', `${B}/`)).toBe('plain');
  });
});

describe('withFinishedHead', () => {
  it('rewrites HTML, keeping the status and dropping the stale length', async () => {
    const res = await withFinishedHead(
      new Response(page(TITLE), { status: 404, headers: { 'content-type': 'text/html', 'content-length': '5' } }),
      `${B}/nope`,
    );
    expect(res.status).toBe(404);
    expect(res.headers.get('content-length')).toBeNull();
    expect(await res.text()).toContain('og:title');
  });

  it('passes anything else through', async () => {
    const res = new Response('{}', { headers: { 'content-type': 'application/json' } });
    expect(await withFinishedHead(res, `${B}/x`)).toBe(res);
  });
});
