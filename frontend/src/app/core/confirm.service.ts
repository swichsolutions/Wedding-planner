import { Injectable, signal } from '@angular/core';

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
