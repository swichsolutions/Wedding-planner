import { Injectable, signal } from '@angular/core';

/**
 * Controls the global sign-in modal (Zola/Knot-style popup). The navbar "Sign in"
 * opens it; the LoginModal component (mounted once at app root) renders it.
 */
@Injectable({ providedIn: 'root' })
export class AuthModalService {
  readonly isOpen = signal(false);

  open(): void {
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }
}
