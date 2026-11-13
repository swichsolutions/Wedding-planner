import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import {
  provideClientHydration,
  withEventReplay,
  withHttpTransferCacheOptions,
  withIncrementalHydration,
} from '@angular/platform-browser';
import { HttpRequest, provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideTranslateService, provideTranslateLoader } from '@ngx-translate/core';

import { routes } from './app.routes';
import { DEFAULT_LANG } from './i18n/languages';
import { StaticTranslateLoader } from './i18n/static-translate.loader';
import { LanguageService } from './i18n/language.service';
import { authInterceptor } from './core/auth.interceptor';

/** API GETs that answer the same to everyone, signed in or not: the catalog (list, categories,
 * pairings, one vendor), published content, and a couple's public invitation. Not a vendor's
 * reviews (they mark the visitor's own), not the invitation search or a personal RSVP link, and
 * nothing under /api/planning, /api/plan, /api/account, /api/vendor/me or /api/admin. */
const SAME_FOR_EVERYONE =
  /\/api\/(?:vendors(?:\/(?:categories|pairings|[^/]+\/[^/]+\/[^/]+))?|content(?:\/[^/]+\/[^/]+)?|sites\/(?!search$)[^/]+)$/;

/**
 * Which server-fetched answers the browser may reuse on a hard load instead of asking again.
 * The server never has a token, so what it fetched is always the signed-out answer. A signed-out
 * visitor reuses all of it, as before. A signed-in visitor's requests carry the token (the auth
 * interceptor runs first), and Angular used to skip every one of them: the catalog was drawn by
 * the server, replaced by skeletons, and fetched a second time. Now they reuse the answers that
 * don't depend on who asks, and still fetch the rest with their token.
 */
function reusableFromServer(req: HttpRequest<unknown>): boolean {
  if (!req.headers.has('Authorization')) return true;
  return SAME_FOR_EVERYONE.test(req.url.split('?')[0]);
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      // Scroll to top on forward navigation, restore position on back/forward.
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
    ),
    provideClientHydration(
      withEventReplay(),
      // Parts of a server-rendered page can stay as plain HTML until they are needed
      // (@defer (hydrate on viewport) in a template, e.g. the home page's sections below the
      // first screen): their code is fetched and run when they scroll into view, or at once
      // when a visitor clicks or types in them (the event is replayed).
      withIncrementalHydration(),
      withHttpTransferCacheOptions({ includeRequestsWithAuthHeaders: true, filter: reusableFromServer }),
    ),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideTranslateService({
      lang: DEFAULT_LANG,
      fallbackLang: DEFAULT_LANG,
      loader: provideTranslateLoader(StaticTranslateLoader),
    }),
    provideAppInitializer(() => inject(LanguageService).init()),
  ],
};
