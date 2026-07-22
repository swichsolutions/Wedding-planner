import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
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
 * JWT auth. Token + user persisted in localStorage (SSR-safe: empty on server). The
 * HTTP interceptor reads `token` to authorize API calls.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly base = environment.apiBaseUrl;

  private readonly _token = signal<string | null>(this.read(TOKEN_KEY));
  readonly user = signal<AuthUser | null>(this.readUser());

  readonly isAuthenticated = computed(() => !!this.user());
  readonly isVendor = computed(() => this.user()?.roles.includes('Vendor') ?? false);
  readonly isAdmin = computed(() => this.user()?.roles.includes('Admin') ?? false);
  readonly isCouple = computed(() => this.user()?.roles.includes('Couple') ?? false);

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
    this.user.set(null);
    if (this.isBrowser) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  }

  private store(r: AuthResponse): void {
    const user: AuthUser = { email: r.email, roles: r.roles, vendorId: r.vendorId };
    this._token.set(r.token);
    this.user.set(user);
    if (this.isBrowser) {
      localStorage.setItem(TOKEN_KEY, r.token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  }

  private read(key: string): string | null {
    return this.isBrowser ? localStorage.getItem(key) : null;
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
