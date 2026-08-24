import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, PLATFORM_ID, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { environment } from '../../environments/environment';
import { SILENT_AUTH_401 } from './auth.interceptor';
import { AuthService } from './auth.service';

/**
 * Vendor unread-message count that backs the navbar notification badge. Loaded when the user
 * becomes an authenticated vendor (app start / sign-in) and kept in sync as they read messages.
 * Browser-only (the token lives in localStorage); no polling — messages aren't second-critical
 * and real-time is out of MVP scope.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly base = environment.apiBaseUrl;

  readonly unread = signal(0);

  /** Stale-response guard (mirrors the wishlist): a slow stats response from a
   *  previous account/session must not repaint the badge after a switch. */
  private loadSeq = 0;

  constructor() {
    // Refresh when the user becomes a vendor; clear on sign-out / role change.
    // Keyed on the account identity too — a vendor→vendor account switch keeps
    // the role boolean true but must still refetch the new account's badge.
    effect(() => {
      const isVendor = this.auth.isVendor();
      void this.auth.user()?.email;
      if (!this.isBrowser) return;
      if (isVendor) this.refresh();
      else {
        this.loadSeq++; // invalidate any in-flight fetch from the previous account
        this.unread.set(0);
      }
    });
  }

  /** Fetch the current unread count from the vendor stats endpoint. */
  refresh(): void {
    if (!this.isBrowser || !this.auth.isVendor()) return;
    const seq = ++this.loadSeq;
    this.http
      .get<{ unreadMessages: number }>(`${this.base}/api/vendor/me/stats`, {
        // Background fetch: an expired-token 401 must not navigate to /login.
        context: new HttpContext().set(SILENT_AUTH_401, true),
      })
      .subscribe({
        next: (s) => {
          if (seq === this.loadSeq) this.unread.set(s.unreadMessages ?? 0);
        },
        error: () => {},
      });
  }

  /** Set the count from an authoritative source (e.g. the dashboard's loaded message list). */
  setUnread(count: number): void {
    this.unread.set(Math.max(0, count));
  }

  /** Decrement as the vendor reads a message, so the badge updates immediately. */
  markOneRead(): void {
    this.unread.update((n) => Math.max(0, n - 1));
  }
}
