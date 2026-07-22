import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  /** i18n key — translated where rendered. */
  message: string;
}

/**
 * Transient notifications, rendered by the single <app-toasts> stack in the app
 * root. Browser-only by nature — show() is a no-op during SSR.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private seq = 0;
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  show(message: string, kind: ToastKind = 'info', durationMs = 4000): void {
    if (!this.isBrowser) return;
    const id = ++this.seq;
    this._toasts.update((list) => [...list, { id, kind, message }]);
    setTimeout(() => this.dismiss(id), durationMs);
  }

  success(message: string): void {
    this.show(message, 'success');
  }

  /** Errors linger longer — the user needs time to notice something went wrong. */
  error(message: string): void {
    this.show(message, 'error', 6000);
  }

  dismiss(id: number): void {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
