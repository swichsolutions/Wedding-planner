import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, afterNextRender, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

import { environment } from '../../environments/environment';

export interface AuthUser {
  email: string;
  roles: string[];
  vendorId: number | null;
}

interface AuthResponse {
  token: string;
  email: string;
  roles: string[];
  vendorId: number | null;
}

export interface RegisterVendorPayload {
  email: string;
  password: string;
  vendorName: string;
  categorySlug: string;
  city?: string;
}

export interface RegisterCouplePayload {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  partnerFirstName?: string;
  partnerLastName?: string;
  weddingDate?: string | null; // 'yyyy-MM-dd'
  planningStage?: string | null;
  guestCountRange?: string | null;
  neededCategories?: string[];
}

const TOKEN_KEY = 'ipsum.auth.token';
const USER_KEY = 'ipsum.auth.user';

/**
 * Routes that render session-owned data. A tab sitting on one of these is evicted
 * when the session changes under it cross-tab; public pages (browse, profiles,
 * home) just re-render from the signals and are left alone.
 */
const SESSION_ROUTES = ['/dashboard', '/admin', '/account', '/planning', '/budget', '/website', '/saved'];

/**
 * localStorage can THROW on mere access (Chrome "Block all cookies", some embedded
 * webviews) — not just be absent. An unguarded touch in a field initializer or the
 * app initializer aborts bootstrap to a blank page, so every read/write/remove in
 * the app goes through these: reads fall back to null, writes become no-ops (the
 * session then simply lives in memory for the tab).
 */
export function safeStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeStorageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage blocked — state stays in memory only
  }
}

export function safeStorageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // storage blocked — nothing was persisted anyway
  }
}

/** Post-sign-in landing page by role: workspace for admins/vendors, planning hub for couples. */
export function defaultRouteFor(user: AuthUser | null): string {
  const roles = user?.roles ?? [];
  if (roles.includes('Admin')) return '/admin';
  if (roles.includes('Vendor')) return '/dashboard';
  if (roles.includes('Couple')) return '/planning';
  return '/';
}

/**
 * Validate a ?returnUrl= before navigating to it. Internal app paths only — never
 * a full URL someone pasted into the query string — and never an auth page:
 * /login, /signup, /join or /register as targets bounce a signed-in user straight
 * back into the auth flows. Returns null when the url isn't safe to use.
 */
export function safeReturnUrl(url: string | null): string | null {
  if (!url || !url.startsWith('/') || url.startsWith('//')) return null;
  const authPages = ['/login', '/signup', '/join', '/register'];
  return authPages.some((p) => url.startsWith(p)) ? null : url;
}

/**
 * JWT auth. Token + user persisted in localStorage (SSR-safe: empty on server). The
 * HTTP interceptor reads `token` to authorize API calls.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly base = environment.apiBaseUrl;

  private readonly _token = signal<string | null>(this.read(TOKEN_KEY));
  private readonly _user = signal<AuthUser | null>(this.readUser());

  /**
   * Hydration gate for UI-facing auth state. The server renders signed-out (no
   * token there), but the client restores the session from localStorage
   * synchronously — so a signed-in user's first client render would disagree
   * with the server DOM on every @if(auth...) branch and abort hydration
   * (NG0500, lost event replay). afterNextRender never runs on the server;
   * flipping this after the first (hydrating) render keeps that render
   * identical to the server's and lets the chrome switch one tick later.
   */
  private readonly hydrated = signal(false);

  /**
   * UI-facing session. null until hydration completes so templates match the
   * server DOM; route guards must NOT use this — they run before the first
   * render and would bounce signed-in hard-loads to /login. They read
   * sessionUser() instead.
   */
  readonly user = computed(() => (this.isBrowser && !this.hydrated() ? null : this._user()));

  constructor() {
    afterNextRender(() => this.hydrated.set(true));

    // Multi-tab sync: signing in or out in one tab must not leave the others on a
    // stale in-memory session. The storage event fires only in NON-originating
    // tabs, so re-reading both keys here mirrors the startup restore exactly (a
    // null key means localStorage.clear()).
    if (this.isBrowser) {
      window.addEventListener('storage', (e) => {
        if (e.key !== null && e.key !== TOKEN_KEY && e.key !== USER_KEY) return;
        const oldToken = this._token();
        this._token.set(this.read(TOKEN_KEY));
        this._user.set(this.readUser());
        // Evict session-scoped pages on ANY session change, not just sign-out:
        // - removal: guards only run on navigation, so the tab would sit on a
        //   protected page firing unauthenticated requests;
        // - swap (signed into a DIFFERENT account in another tab): the couple
        //   pages' one-shot load latches would keep showing account A's data
        //   and write every subsequent edit into account B's session.
        // Public pages just re-render from the signals — no eviction.
        const sessionChanged = oldToken !== null && this._token() !== oldToken;
        if (sessionChanged && SESSION_ROUTES.some((p) => this.router.url.startsWith(p))) {
          this.router.navigateByUrl('/');
        }
      });
    }
  }

  readonly isAuthenticated = computed(() => !!this.user());
  readonly isVendor = computed(() => this.user()?.roles.includes('Vendor') ?? false);
  readonly isAdmin = computed(() => this.user()?.roles.includes('Admin') ?? false);
  readonly isCouple = computed(() => this.user()?.roles.includes('Couple') ?? false);

  /** Ungated session read for route guards (correct before hydration completes). */
  sessionUser(): AuthUser | null {
    return this._user();
  }

  get token(): string | null {
    return this._token();
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.base}/api/auth/login`, { email, password })
      .pipe(tap((r) => this.store(r)));
  }

  /** Exchange a Google ID token (credential) for our own JWT; creates a couple account first time. */
  googleLogin(credential: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.base}/api/auth/google`, { credential })
      .pipe(tap((r) => this.store(r)));
  }

  registerVendor(payload: RegisterVendorPayload): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.base}/api/auth/register/vendor`, payload)
      .pipe(tap((r) => this.store(r)));
  }

  registerCouple(payload: RegisterCouplePayload): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.base}/api/auth/register/couple`, payload)
      .pipe(tap((r) => this.store(r)));
  }

  logout(): void {
    this._token.set(null);
    this._user.set(null);
    if (this.isBrowser) {
      safeStorageRemove(TOKEN_KEY);
      safeStorageRemove(USER_KEY);
    }
  }

  private store(r: AuthResponse): void {
    const user: AuthUser = { email: r.email, roles: r.roles, vendorId: r.vendorId };
    this._token.set(r.token);
    this._user.set(user);
    if (this.isBrowser) {
      safeStorageSet(TOKEN_KEY, r.token);
      safeStorageSet(USER_KEY, JSON.stringify(user));
    }
  }

  private read(key: string): string | null {
    return this.isBrowser ? safeStorageGet(key) : null;
  }

  private readUser(): AuthUser | null {
    try {
      const raw = this.read(USER_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  }
}
