// Content/SEO surface models — guides, checklists, real weddings (CLAUDE.md ContentPage).
// Bilingual fields (ka primary, en secondary); the UI picks the active language.

export type ContentType = 'guide' | 'checklist' | 'realWedding';

export interface ContentArticle {
  slug: string;
  type: ContentType;
  titleKa: string;
  titleEn: string;
  excerptKa: string;
  excerptEn: string;
  /** Body as paragraphs, per language. */
  bodyKa: string[];
  bodyEn: string[];
  metaKa: string;
  metaEn: string;
  image: string;
  imageAlt: string;
  /** ISO date string. */
  date: string;
}
