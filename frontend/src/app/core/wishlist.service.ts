import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

/**
 * Couple wishlist of saved vendor ids — now server-backed and gated behind a couple
 * account (was localStorage-only). The list follows the account across devices via
 * `/api/planning/saved` (Couple role). Guests have an empty list; the UI prompts them
 * to register when they tap a save heart (see VendorCard).
 *
 * SSR-safe: the server render has no auth token, so we only sync in the browser.
 */
@Injectable({ providedIn: 'root' })
export class WishlistService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly base = environment.apiBaseUrl;

  private readonly _ids = signal<number[]>([]);
  readonly ids = this._ids.asReadonly();
  readonly count = computed(() => this._ids().length);

  constructor() {
    // Load the couple's saved vendors on sign-in; clear on sign-out (browser only).
    effect(() => {
      const isCouple = this.auth.isCouple();
      if (!this.isBrowser) return;
      if (isCouple) {
        this.http.get<number[]>(`${this.base}/api/planning/saved`).subscribe({
          next: (ids) => this._ids.set(ids),
          error: () => this._ids.set([]),
        });
      } else {
        this._ids.set([]);
      }
    });
  }

  isSaved(id: number): boolean {
    return this._ids().includes(id);
  }

  /**
   * Toggle a vendor in the couple's wishlist. No-op for non-couples — the UI intercepts
   * their taps and prompts registration before this is ever called. Updates optimistically
   * and rolls back if the server call fails.
   */
  toggle(id: number): void {
    if (!this.auth.isCouple()) return;

    const previous = this._ids();
    const wasSaved = previous.includes(id);
    this._ids.set(wasSaved ? previous.filter((x) => x !== id) : [...previous, id]);

    const request = wasSaved
      ? this.http.delete<void>(`${this.base}/api/planning/saved/${id}`)
      : this.http.post<void>(`${this.base}/api/planning/saved`, { vendorId: id });

    request.subscribe({ error: () => this._ids.set(previous) });
  }
}
