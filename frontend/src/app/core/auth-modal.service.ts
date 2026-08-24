import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationStart, Router } from '@angular/router';

/**
 * Controls the global sign-in modal (Zola/Knot-style popup). The navbar "Sign in"
 * opens it; the LoginModal component (mounted once at app root) renders it.
 */
@Injectable({ providedIn: 'root' })
export class AuthModalService {
  readonly isOpen = signal(false);

  constructor() {
    // Back/forward (or any navigation) with the modal open must not leave the
    // overlay floating over the new page. The component watches isOpen and runs
    // its own cleanup (cancel in-flight login, reset form) on this transition.
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      inject(Router).events.subscribe((e) => {
        if (e instanceof NavigationStart) this.isOpen.set(false);
      });
    }
  }

  open(): void {
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }
}
