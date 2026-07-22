/** Supported UI languages. Georgian is primary/default; English is secondary. */
export type LangCode = 'ka' | 'en';

export const DEFAULT_LANG: LangCode = 'ka';

export const SUPPORTED_LANGS: { code: LangCode; label: string }[] = [
  { code: 'ka', label: 'ქართული' },
  { code: 'en', label: 'English' },
];

export const LANG_STORAGE_KEY = 'ipsum.lang';
