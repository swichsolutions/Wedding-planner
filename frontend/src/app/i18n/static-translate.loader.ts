import { Injectable } from '@angular/core';
import { TranslateLoader, TranslationObject } from '@ngx-translate/core';
import { Observable, from, of } from 'rxjs';

import ka from './ka.json';

/**
 * Georgian, the default and the language the server renders, is bundled into the app: the
 * server renders fully-translated HTML synchronously, with no network round-trip, which matters
 * for SEO (CLAUDE.md). English is only needed when a visitor picks it, so it loads on demand as
 * its own chunk and stays out of the first page load (LanguageService waits for it at startup
 * when English is the stored choice).
 */
@Injectable({ providedIn: 'root' })
export class StaticTranslateLoader implements TranslateLoader {
  getTranslation(lang: string): Observable<TranslationObject> {
    if (lang === 'ka') return of(ka as TranslationObject);
    if (lang === 'en') return from(import('./en.json').then((m) => m.default as TranslationObject));
    return of({});
  }
}
