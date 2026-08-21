import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from './auth.service';

/**
 * Attaches the JWT bearer token to outgoing API requests when the user is signed in.
 * If a token-bearing request comes back 401, the stored session is stale (expired or
 * invalidated) — clear it and send the user to sign in again with an explanatory
 * notice, instead of leaving every page to fail with a generic load error.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token;

  if (!token) return next(req);

  req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });

  return next(req).pipe(
    catchError((err: unknown) => {
      // /api/auth/* returns 401 for bad credentials — that's the login form's error
      // to show, not an expired session.
      if (
        err instanceof HttpErrorResponse &&
        err.status === 401 &&
        !req.url.includes('/api/auth/')
      ) {
        auth.logout();
        router.navigate(['/login'], {
          queryParams: { expired: 1, returnUrl: router.url },
        });
      }
      return throwError(() => err);
    }),
  );
};
