import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { environment } from '../../environments/environment';
import { SILENT_AUTH_401 } from './auth.interceptor';
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

  /**
   * Settled state of the saved-list load, for pages that must not render a false
   * "nothing saved yet" while the GET is in flight or after it failed. loaded
   * means the state is settled (success OR failure); loadError distinguishes.
   * Non-couples settle immediately — there is nothing to load.
   */
  readonly loaded = signal(false);
  readonly loadError = signal(false);

  /** Ids with a toggle request in flight — re-entry is ignored until it settles. */
  private readonly inFlight = new Set<number>();
  /** Stale-response guard: bumped on every auth change; old loads can't apply. */
  private loadSeq = 0;
  private readonly reloadTick = signal(0);

  /** Re-run the saved-list load (the saved page's Retry after a loadError). */
  reload(): void {
    this.reloadTick.update((n) => n + 1);
  }

  constructor() {
    // Load the couple's saved vendors on sign-in; clear on sign-out (browser only).
    effect(() => {
      const isCouple = this.auth.isCouple();
      // Depend on the account identity, not just the role boolean — a couple→couple
      // account switch must refetch, and a slow response from the previous account
      // must not overwrite the new one's list (seq guard below).
      void this.auth.user()?.email;
      this.reloadTick();
      if (!this.isBrowser) return;
      const seq = ++this.loadSeq;
      if (isCouple) {
        this.loaded.set(false);
        this.loadError.set(false);
        // Background sync: an expired-token 401 signs the user out quietly
        // instead of throwing a login wall over whatever page they're reading.
        this.http
          .get<number[]>(`${this.base}/api/planning/saved`, {
            context: new HttpContext().set(SILENT_AUTH_401, true),
          })
          .subscribe({
          next: (ids) => {
            if (seq !== this.loadSeq) return; // a newer auth state owns the list
            this._ids.set(ids);
            this.loaded.set(true);
          },
          error: () => {
            if (seq !== this.loadSeq) return;
            this._ids.set([]);
            this.loaded.set(true);
            this.loadError.set(true);
          },
        });
      } else {
        this._ids.set([]);
        this.loaded.set(true);
        this.loadError.set(false);
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
    // One request per vendor at a time: a rapid double-tap would race a POST
    // against a DELETE, and out-of-order server processing persists the
    // opposite of what the UI shows.
    if (this.inFlight.has(id)) return;
    this.inFlight.add(id);

    const wasSaved = this._ids().includes(id);
    this._ids.update((list) => (wasSaved ? list.filter((x) => x !== id) : [...list, id]));

    const request = wasSaved
      ? this.http.delete<void>(`${this.base}/api/planning/saved/${id}`)
      : this.http.post<void>(`${this.base}/api/planning/saved`, { vendorId: id });

    request.subscribe({
      next: () => this.inFlight.delete(id),
      error: () => {
        this.inFlight.delete(id);
        // Revert only THIS id — restoring a whole snapshot would erase other
        // vendors' toggles that succeeded while this request was in flight.
        this._ids.update((list) =>
          wasSaved ? (list.includes(id) ? list : [...list, id]) : list.filter((x) => x !== id),
        );
      },
    });
  }
}
