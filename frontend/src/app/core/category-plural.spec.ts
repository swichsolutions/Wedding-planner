import { describe, expect, it } from 'vitest';
import en from '../i18n/en.json';
import ka from '../i18n/ka.json';

describe('category names', () => {
  it('every category has a plural in both languages', () => {
    for (const [name, lang] of [['ka', ka], ['en', en]] as const) {
      const missing = Object.keys(lang.category).filter((k) => !(k in lang.categoryPlural));
      expect(missing, `missing in ${name}`).toEqual([]);
    }
  });
});
