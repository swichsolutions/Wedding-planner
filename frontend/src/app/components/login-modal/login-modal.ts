import {
  Component,
  ElementRef,
  HostListener,
  NgZone,
  PLATFORM_ID,
  effect,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../core/auth.service';
import { AuthModalService } from '../../core/auth-modal.service';
import { focusFirstInvalid } from '../../core/forms';
import { environment } from '../../../environments/environment';

// Google Identity Services (loaded on demand from https://accounts.google.com/gsi/client).
declare const google: {
  accounts: {
    id: {
      initialize(config: { client_id: string; callback: (r: { credential: string }) => void }): void;
      renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
    };
  };
};

/**
 * Global sign-in popup (Zola/Knot-style). One login for everyone (couple or vendor).
 * "Sign up" → couple onboarding (/signup); "Are you a vendor? Start here" → /register.
 * Google sign-in uses Google Identity Services: the browser gets an ID token which we exchange
 * at POST /api/auth/google for our own JWT (creating a couple account on first sign-in).
 */
@Component({
  selector: 'app-login-modal',
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './login-modal.html',
  styleUrl: './login-modal.scss',
})
export class LoginModal {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  protected readonly modal = inject(AuthModalService);

  protected readonly error = signal(false);
  protected readonly loading = signal(false);
  protected readonly googleError = signal(false);
  /** Set on a failed submit — reveals the inline email/password validation messages. */
  protected readonly attempted = signal(false);
  protected readonly googleEnabled = !!environment.googleClientId;

  private gisReady = false;

  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  constructor() {
    // lock body scroll + focus the email field while the modal is open (browser only)
    effect(() => {
      const open = this.modal.isOpen();
      if (!this.isBrowser) return;
      document.body.style.overflow = open ? 'hidden' : '';
      if (open) {
        this.error.set(false);
        this.googleError.set(false);
        this.attempted.set(false);
        queueMicrotask(() => {
          (this.host.nativeElement.querySelector('#lm-email') as HTMLElement | null)?.focus();
          void this.renderGoogleButton();
        });
      }
    });
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.modal.isOpen()) this.close();
  }

  protected close(): void {
    this.modal.close();
    this.form.reset();
    this.error.set(false);
    this.attempted.set(false);
  }

  /** Close when the dimmed backdrop (not the card) is clicked. */
  protected onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close();
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.attempted.set(true); // reveal the inline email/password validation messages
      this.form.markAllAsTouched();
      focusFirstInvalid(this.host.nativeElement);
      return;
    }
    this.loading.set(true);
    this.error.set(false);
    const { email, password } = this.form.getRawValue();
    this.auth.login(email!, password!).subscribe({
      next: () => {
        this.loading.set(false);
        this.close();
        this.redirect();
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  /** Vendors/admins go to their workspace; couples stay on the current page. */
  private redirect(): void {
    const roles = this.auth.user()?.roles ?? [];
    if (roles.includes('Admin')) this.router.navigateByUrl('/admin');
    else if (roles.includes('Vendor')) this.router.navigateByUrl('/dashboard');
  }

  /** Load the GIS library (once), initialise it, and draw Google's button into the modal. */
  private async renderGoogleButton(): Promise<void> {
    if (!this.isBrowser || !this.googleEnabled) return;
    const container = this.host.nativeElement.querySelector('#lm-google-btn') as HTMLElement | null;
    if (!container) return;

    try {
      await this.loadGis();
    } catch {
      this.zone.run(() => this.googleError.set(true));
      return;
    }

    if (!this.gisReady) {
      google.accounts.id.initialize({
        client_id: environment.googleClientId,
        callback: (r) => this.onGoogleCredential(r.credential),
      });
      this.gisReady = true;
    }

    container.innerHTML = '';
    const width = Math.min(400, Math.max(240, container.offsetWidth || 320));
    google.accounts.id.renderButton(container, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      logo_alignment: 'center',
      width,
    });
  }

  /** GIS fires this (outside Angular's zone) with the Google ID token; exchange it for our JWT. */
  private onGoogleCredential(credential: string): void {
    this.zone.run(() => {
      this.loading.set(true);
      this.googleError.set(false);
      this.error.set(false);
      this.auth.googleLogin(credential).subscribe({
        next: () => {
          this.loading.set(false);
          this.close();
          this.redirect();
        },
        error: () => {
          this.googleError.set(true);
          this.loading.set(false);
        },
      });
    });
  }

  /** Inject the Google Identity Services script tag once; resolve when it's ready. */
  private loadGis(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (typeof google !== 'undefined' && google?.accounts?.id) {
        resolve();
        return;
      }
      const existing = document.getElementById('gis-client') as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('GIS failed to load')));
        return;
      }
      const script = document.createElement('script');
      script.id = 'gis-client';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('GIS failed to load'));
      document.head.appendChild(script);
    });
  }

  protected goSignup(): void {
    this.close();
    this.router.navigateByUrl('/signup');
  }

  protected goVendor(): void {
    this.close();
    this.router.navigateByUrl('/register');
  }
}
