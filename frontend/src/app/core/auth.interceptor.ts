import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

/**
 * Attaches the JWT bearer token to outgoing requests aimed at OUR API — never to
 * third-party origins, where it would leak the session. A 401 from a non-auth API
 * endpoint means the session is stale (expired, invalidated, or signed out in
 * another tab): clear it and send the user to sign in again with an explanatory
 * notice, instead of leaving every page to fail with a generic load error.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  const base = environment.apiBaseUrl;

  // Scope to the API: relative /api paths, or absolute URLs under the configured base.
  const isApi = req.url.startsWith('/api') || (base !== '' && req.url.startsWith(base));
  if (!isApi) return next(req);

  const token = auth.token;
  if (token) req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });

  return next(req).pipe(
    catchError((err: unknown) => {
      // Tokenless requests 401 too (e.g. this tab kept firing after a cross-tab
      // sign-out) and deserve the same redirect — hence no early return above.
      // /api/auth/* returns 401 for bad credentials — that's the login form's
      // error to show, not an expired session. Browser only: SSR must never
      // trigger router navigation from a fetch.
      if (
        isBrowser &&
        err instanceof HttpErrorResponse &&
        err.status === 401 &&
        !req.url.includes('/api/auth/')
      ) {
        if (token) auth.logout();
        // Concurrent 401s: the first one already landed us on /login. A second
        // navigation here would capture the login URL itself as returnUrl
        // (returnUrl=/login?expired=1...), bouncing the user straight back to
        // the login page after they sign in — so skip it.
        if (!router.url.startsWith('/login')) {
          router.navigate(['/login'], {
            queryParams: { expired: 1, returnUrl: router.url },
          });
        }
      }
      return throwError(() => err);
    }),
  );
};
