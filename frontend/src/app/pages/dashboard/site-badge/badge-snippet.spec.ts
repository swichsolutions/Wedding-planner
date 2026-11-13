import { describe, expect, it } from 'vitest';
import { badgePath, badgeSnippet, profileUrl } from './badge-snippet';

const vendor = { name: 'სტუდია ნათელი', categorySlug: 'fotografi', citySlug: 'tbilisi', slug: 'studia-nateli' };

describe('badge snippet', () => {
  it('links to the public profile by its absolute address', () => {
    expect(profileUrl(vendor)).toBe('https://weddingplanner.ge/fotografi/tbilisi/studia-nateli');
  });

  it('is the followed link with the badge image, as the vendor pastes it', () => {
    expect(badgeSnippet(vendor, 'ka', 'light')).toBe(
      '<a href="https://weddingplanner.ge/fotografi/tbilisi/studia-nateli" title="სტუდია ნათელი WeddingPlanner-ზე">' +
        '<img src="https://weddingplanner.ge/badge/badge-ka-light.svg" alt="ვართ WeddingPlanner-ზე" width="200" height="56"></a>',
    );
    expect(badgeSnippet(vendor, 'en', 'dark')).toContain('src="https://weddingplanner.ge/badge/badge-en-dark.svg"');
    expect(badgeSnippet(vendor, 'en', 'dark')).toContain('title="სტუდია ნათელი on WeddingPlanner"');
    expect(badgeSnippet(vendor, 'en', 'dark')).toContain('alt="Find us on WeddingPlanner"');
  });

  it('never asks search engines to ignore the link', () => {
    expect(badgeSnippet(vendor, 'ka', 'dark')).not.toContain('nofollow');
  });

  it("escapes the vendor's name inside the title attribute", () => {
    const html = badgeSnippet({ ...vendor, name: 'Tom & "Jerry" <b>' }, 'en', 'light');
    expect(html).toContain('title="Tom &amp; &quot;Jerry&quot; &lt;b&gt; on WeddingPlanner"');
  });

  it('names one of the four files in public/badge', () => {
    expect(badgePath('ka', 'dark')).toBe('/badge/badge-ka-dark.svg');
  });
});
