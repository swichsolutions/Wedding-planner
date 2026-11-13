import { Marked } from 'marked';

import { movedAddress } from './old-addresses';

/**
 * Markdown → HTML for content bodies (articles, stories, legal pages). Content is written by
 * admins, and the result is bound with [innerHTML], which Angular sanitizes as well (scripts,
 * event handlers and javascript: URLs are stripped) — so this stays safe if an admin account
 * is ever misused. Raw HTML in the source is escaped rather than passed through.
 */
const md = new Marked({
  gfm: true,
  breaks: false,
  // A text written before 2026-11-13 may link to an address that has moved since
  // ("/vendors?category=fotografi"): the page links straight to today's, not through a redirect.
  walkTokens(token) {
    if (token.type === 'link') token['href'] = movedAddress(token['href']) ?? token['href'];
  },
  renderer: {
    // Escape any raw HTML block or inline tag instead of rendering it.
    html({ text }) {
      return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },
  },
});

export function renderMarkdown(source: string | null | undefined): string {
  if (!source) return '';
  return md.parse(source, { async: false }) as string;
}
