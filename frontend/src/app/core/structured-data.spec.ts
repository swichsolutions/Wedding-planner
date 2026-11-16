import { describe, expect, it } from 'vitest';

import { breadcrumbList, jsonLdText, webPage } from './structured-data';

const written = (data: unknown) => JSON.parse(jsonLdText(data));

describe('jsonLdText', () => {
  // Search Console, 2026-11-16: "Invalid URL in field id (in itemListElement.item)", because the
  // browser rewrote the data with "/rchevebi" after the server's HTML had full addresses
  it('writes breadcrumb items as full addresses', () => {
    const data = written(breadcrumbList([{ name: 'მთავარი', path: '/' }, { name: 'რჩევები', path: '/rchevebi' }]));
    expect(data.itemListElement.map((e: { item: string }) => e.item)).toEqual([
      'https://weddingplanner.ge/',
      'https://weddingplanner.ge/rchevebi',
    ]);
  });

  it('makes url, image and @id full, inside arrays too, and leaves other text alone', () => {
    const data = written([
      webPage('WebPage', { name: '/not an address', description: 'd', path: '/ganrigebi', lang: 'ka' }),
      { '@id': '/x#a', image: ['/media/a.webp', 'https://cdn.example/b.webp'], url: '//cdn.example/c' },
    ]);
    expect(data[0].url).toBe('https://weddingplanner.ge/ganrigebi');
    expect(data[0].isPartOf.url).toBe('https://weddingplanner.ge/');
    expect(data[0].name).toBe('/not an address');
    expect(data[1]['@id']).toBe('https://weddingplanner.ge/x#a');
    expect(data[1].image).toEqual(['https://weddingplanner.ge/media/a.webp', 'https://cdn.example/b.webp']);
    expect(data[1].url).toBe('//cdn.example/c'); // protocol-relative: not ours to touch
  });

  it('escapes "<" so no text can close the script tag', () => {
    expect(jsonLdText({ name: '</script><b>' })).not.toContain('<');
  });
});
