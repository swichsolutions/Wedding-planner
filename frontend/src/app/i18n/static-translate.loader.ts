import { Injectable } from '@angular/core';
import { TranslateLoader, TranslationObject } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import ka from './ka.json';
import en from './en.json';

/**
 * Bundles the translation dictionaries directly into the app instead of fetching
 * them over HTTP. This is the SSR-safe approach: the server renders fully-translated
 * HTML synchronously, with no network round-trip — which matters for SEO (CLAUDE.md).
 */
const DICTIONARIES: Record<string, TranslationObject> = {
  ka: ka as TranslationObject,
  en: en as TranslationObject,
};

@Injectable({ providedIn: 'root' })
export class StaticTranslateLoader implements TranslateLoader {
  getTranslation(lang: string): Observable<TranslationObject> {
    return of(DICTIONARIES[lang] ?? {});
  }
}
