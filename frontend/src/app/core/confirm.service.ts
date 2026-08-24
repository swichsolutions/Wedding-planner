import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationStart, Router } from '@angular/router';

export interface ConfirmRequest {
  /** i18n key for the dialog title. */
  title: string;
  /** i18n key for the consequence/body line. */
  body?: string;
  /** Raw text highlighted under the title (e.g. the item's name) — shown untranslated. */
  detail?: string;
  /** i18n key for the confirm button (default confirm.ok). */
  confirmLabel?: string;
  /** i18n key for the cancel button (default confirm.cancel). */
  cancelLabel?: string;
  /** Destructive styling — red confirm button + warning icon. */
  danger?: boolean;
}

/**
 * App-wide confirmation dialog. Call confirm() from anywhere; the single
 * <app-confirm-dialog> in the app root renders it and settles the promise.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly _request = signal<ConfirmRequest | null>(null);
  readonly request = this._request.asReadonly();
  private resolver: ((ok: boolean) => void) | null = null;

  constructor() {
    // Navigating away cancels an open confirm: the overlay must not survive onto
    // the next page, and running the previous (destroyed) page's continuation is
    // never right — the caller's promise settles false.
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      inject(Router).events.subscribe((e) => {
        if (e instanceof NavigationStart && this._request()) this.settle(false);
      });
    }
  }

  /** Resolves true on confirm; false on cancel, Escape, or backdrop click. */
  confirm(request: ConfirmRequest): Promise<boolean> {
    this.resolver?.(false); // a newer request supersedes an unanswered one
    this._request.set(request);
    return new Promise((resolve) => (this.resolver = resolve));
  }

  /** Called by the dialog component with the user's answer. */
  settle(ok: boolean): void {
    this.resolver?.(ok);
    this.resolver = null;
    this._request.set(null);
  }
}
