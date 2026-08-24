import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

/**
 * Role-based route guard. Auth state lives in localStorage (browser only), so on the
 * server we let the route render (private pages are noindex) and enforce on the client.
 */
export function roleGuard(role?: string): CanActivateFn {
  return (_route, state) => {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return true;

    const auth = inject(AuthService);
    const router = inject(Router);

    // sessionUser(), not user(): the UI-facing signal reads null until hydration
    // completes, and guards run before the first render — the gated read would
    // bounce every signed-in hard-load to /login.
    const user = auth.sessionUser();

    // Carry the attempted destination so signing in lands the user where they
    // were headed, not on a generic page.
    if (!user) return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
    if (role && !user.roles.includes(role)) return router.createUrlTree(['/']);
    return true;
  };
}
