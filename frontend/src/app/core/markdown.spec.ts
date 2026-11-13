import { describe, expect, it } from 'vitest';

import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('renders headings, emphasis, links, lists and images', () => {
    const html = renderMarkdown(
      '## ბიუჯეტი\n\n**მუქი** და *დახრილი* — [ნახე](/vendors)\n\n- ერთი\n- ორი\n\n![ფოტო](https://x.test/a.webp)',
    );
    expect(html).toContain('<h2>ბიუჯეტი</h2>');
    expect(html).toContain('<strong>მუქი</strong>');
    expect(html).toContain('<em>დახრილი</em>');
    expect(html).toContain('<a href="/vendors">ნახე</a>');
    expect(html).toContain('<li>ერთი</li>');
    expect(html).toContain('<img src="https://x.test/a.webp" alt="ფოტო">');
  });

  it('links to today’s address where a text still has one that moved', () => {
    const html = renderMarkdown('[a](/vendors?category=fotografi) [b](/schedules) [c](/budget?view=overview) [d](https://x.test/guides)');
    expect(html).toContain('<a href="/fotografi">a</a>');
    expect(html).toContain('<a href="/ganrigebi">b</a>');
    expect(html).toContain('<a href="/budget?view=overview">c</a>');
    expect(html).toContain('<a href="https://x.test/guides">d</a>');
  });

  it('escapes raw HTML instead of passing it through', () => {
    const html = renderMarkdown('<script>alert(1)</script>\n\ntext <img src=x onerror=alert(1)>');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
  });

  it('returns an empty string for empty input', () => {
    expect(renderMarkdown(null)).toBe('');
    expect(renderMarkdown('')).toBe('');
  });
});
