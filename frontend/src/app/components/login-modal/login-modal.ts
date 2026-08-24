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
import { Subscription } from 'rxjs';

import { AuthService } from '../../core/auth.service';
import { AuthModalService } from '../../core/auth-modal.service';
import { trapTabKey } from '../../core/a11y';
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
  /** The in-flight sign-in request — cancelled if the modal is dismissed. */
  private pending: Subscription | null = null;
  /** True when the current press started on the backdrop itself (not inside the card). */
  private pressOnBackdrop = false;
  /** Whatever had focus when the modal opened — focus returns there on close. */
  private modalTrigger: HTMLElement | null = null;

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
        // Captured before our own focus move below — this is the navbar button
        // (or whatever else) that focus must return to on close.
        this.modalTrigger = document.activeElement as HTMLElement | null;
        this.error.set(false);
        this.googleError.set(false);
        this.attempted.set(false);
        queueMicrotask(() => {
          (this.host.nativeElement.querySelector('#lm-email') as HTMLElement | null)?.focus();
          void this.renderGoogleButton();
        });
      } else if (this.pending || this.modalTrigger) {
        // Closed from OUTSIDE close() — the service shuts the modal on router
        // navigation. Honor the same cancellation contract, but don't steal
        // focus back across a navigation: just drop the trigger.
        this.pending?.unsubscribe();
        this.pending = null;
        this.loading.set(false);
        this.form.reset();
        this.modalTrigger = null;
      }
    });
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.modal.isOpen()) this.close();
  }

  protected close(): void {
    // Dismissal must actually cancel: an in-flight login left running would land
    // later, store a session via its tap(), and teleport the user to a dashboard
    // after they said no. Unsubscribing aborts the HTTP request outright.
    this.pending?.unsubscribe();
    this.pending = null;
    this.loading.set(false);
    this.modal.close();
    this.form.reset();
    this.error.set(false);
    this.attempted.set(false);
    this.modalTrigger?.focus(); // back to the element that opened the modal (a11y)
    this.modalTrigger = null;
  }

  /** Keep Tab cycling inside the open modal (the overlay wraps the whole card). */
  protected onOverlayKeydown(event: KeyboardEvent): void {
    trapTabKey(event.currentTarget as HTMLElement, event);
  }

  /** Remember whether the press itself began on the backdrop (vs inside the card). */
  protected onBackdropDown(event: PointerEvent): void {
    this.pressOnBackdrop = event.target === event.currentTarget;
  }

  /**
   * Close only when the interaction both started AND ended on the dimmed backdrop.
   * A text-selection drag that starts in a field and releases over the backdrop
   * fires a click on the backdrop (the common ancestor) — that must not close the
   * modal and wipe the form.
   */
  protected onBackdrop(event: MouseEvent): void {
    const startedHere = this.pressOnBackdrop;
    this.pressOnBackdrop = false;
    if (startedHere && event.target === event.currentTarget) this.close();
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.attempted.set(true); // reveal the inline email/password validation messages
      this.form.markAllAsTouched();
      focusFirstInvalid(this.host.nativeElement);
      return;
    }
    // The invisible Google button stays clickable in the DOM, so a second sign-in
    // can start while one is in flight — the orphaned first subscription would
    // survive close()'s cancellation (only the latest `pending` is unsubscribed),
    // still store its session and still teleport. One pending sign-in at a time.
    this.pending?.unsubscribe();
    this.loading.set(true);
    this.error.set(false);
    const { email, password } = this.form.getRawValue();
    this.pending = this.auth.login(email!, password!).subscribe({
      next: () => {
        this.pending = null;
        this.loading.set(false);
        this.close();
        this.redirect();
      },
      error: () => {
        this.pending = null;
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
      this.pending?.unsubscribe(); // one pending sign-in at a time (see submit())
      this.loading.set(true);
      this.googleError.set(false);
      this.error.set(false);
      this.pending = this.auth.googleLogin(credential).subscribe({
        next: () => {
          this.pending = null;
          this.loading.set(false);
          this.close();
          this.redirect();
        },
        error: () => {
          this.pending = null;
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
      script.onerror = () => {
        // A failed load (adblocker, offline) must not poison every later open:
        // the dead tag would sit in the DOM with its error event already fired,
        // and the `existing` branch above would wait forever on listeners that
        // never fire. Removing it makes the next attempt inject a fresh tag.
        script.remove();
        reject(new Error('GIS failed to load'));
      };
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
