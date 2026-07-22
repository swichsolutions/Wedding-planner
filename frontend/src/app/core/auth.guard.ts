import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

/**
 * Role-based route guard. Auth state lives in localStorage (browser only), so on the
 * server we let the route render (private pages are noindex) and enforce on the client.
 */
export function roleGuard(role?: string): CanActivateFn {
  return () => {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return true;

    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isAuthenticated()) return router.createUrlTree(['/login']);
    if (role && !auth.user()?.roles.includes(role)) return router.createUrlTree(['/']);
    return true;
  };
}
