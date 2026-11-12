import { Component, ElementRef, effect, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Meta } from '@angular/platform-browser';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService, defaultRouteFor, safeReturnUrl } from '../../core/auth.service';
import { AuthModalService } from '../../core/auth-modal.service';
import { focusFirstInvalid } from '../../core/forms';
import { pageTitle } from '../../core/page-title';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  template: `
    <section class="auth">
      <div class="auth__card">
        <h1>{{ 'auth.loginTitle' | translate }}</h1>
        @if (sessionExpired()) {
          <p class="auth__notice" role="alert">{{ 'auth.sessionExpired' | translate }}</p>
        }
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="auth__field">
            <label for="l-email">{{ 'auth.email' | translate }}</label>
            <input id="l-email" type="email" formControlName="email" autocomplete="email" spellcheck="false" aria-required="true"
              [class.is-invalid]="attempted() && form.controls.email.invalid"
              [attr.aria-invalid]="attempted() && form.controls.email.invalid ? 'true' : null" />
            @if (attempted() && form.controls.email.hasError('required')) {
              <span class="auth__err">{{ 'auth.required' | translate }}</span>
            } @else if (attempted() && form.controls.email.hasError('email')) {
              <span class="auth__err">{{ 'auth.emailInvalid' | translate }}</span>
            }
          </div>
          <div class="auth__field">
            <label for="l-pass">{{ 'auth.password' | translate }}</label>
            <input id="l-pass" type="password" formControlName="password" autocomplete="current-password" aria-required="true"
              [class.is-invalid]="attempted() && form.controls.password.invalid"
              [attr.aria-invalid]="attempted() && form.controls.password.invalid ? 'true' : null" />
            @if (attempted() && form.controls.password.hasError('required')) {
              <span class="auth__err">{{ 'auth.required' | translate }}</span>
            }
            <a class="auth__forgot" routerLink="/forgot-password">{{ 'auth.forgotPassword' | translate }}</a>
          </div>
          @if (error()) {
            <p class="auth__error" role="alert">{{ error()! | translate }}</p>
          }
          <button class="btn btn--primary" type="submit" [disabled]="loading()">
            {{ 'auth.signIn' | translate }}
          </button>
        </form>
        <!-- Couples who signed up with Google have no password, and an ended session sends them
             here. As on /signup, Google's own button lives in the sign-in window. -->
        @if (googleEnabled) {
          <p class="login-or"><span>{{ 'auth.or' | translate }}</span></p>
          <button type="button" class="btn btn--outline-ink" (click)="openSignIn()">
            {{ 'signup.withGoogle' | translate }}
          </button>
        }
        <p class="auth__alt">
          {{ 'auth.noAccount' | translate }} <a routerLink="/signup">{{ 'auth.signUp' | translate }}</a>
        </p>
      </div>
    </section>
  `,
  styles: `
    // "or" between the password form and Google (the same line as on /signup). Its gaps follow
    // the window's height so the page still fits one desktop screen (section.auth).
    .login-or {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      margin: clamp(0.5rem, 1.8vh, 1.25rem) 0 clamp(0.125rem, 0.6vh, 0.5rem);
      font-size: var(--fs-caption);
      color: var(--color-text-muted);

      &::before,
      &::after {
        content: '';
        flex: 1;
        height: 1px;
        background: var(--color-border);
      }
    }
  `,
  host: { class: 'theme-brand' },
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly authModal = inject(AuthModalService);

  protected readonly googleEnabled = !!environment.googleClientId;
  /** i18n key of the failure banner, or null. */
  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(false);
  /** Set on a failed submit — reveals the inline email/password validation messages. */
  protected readonly attempted = signal(false);
  /** The interceptor lands here with ?expired=1 when a stored token stops working. */
  protected readonly sessionExpired = signal(
    this.route.snapshot.queryParamMap.has('expired'),
  );

  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  constructor() {
    pageTitle('auth.loginTitle');
    // A sign-in form has nothing to rank for.
    inject(Meta).updateTag({ name: 'robots', content: 'noindex' });

    // Signed-in users have no business here — whether they arrived signed in or
    // signed in mid-page via the navbar modal (which would otherwise strand them on
    // a login form for a session that already exists). Skipped while our own
    // request is in flight — submit() does that navigation itself.
    effect(() => {
      if (this.auth.user() && !this.loading()) this.redirect();
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.attempted.set(true); // reveal the inline email/password validation messages
      this.form.markAllAsTouched();
      focusFirstInvalid(this.host.nativeElement);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();
    this.auth.login(email!, password!).subscribe({
      next: () => this.redirect(),
      error: (err: HttpErrorResponse) => {
        // 429 is the rate limit, not a wrong password: say so, or they keep retyping it.
        this.error.set(err.status === 429 ? 'pwReset.tooMany' : 'auth.invalidCredentials');
        this.loading.set(false);
      },
    });
  }

  /** Google sign-in lives in the sign-in window, which also returns the couple to returnUrl. */
  protected openSignIn(): void {
    this.authModal.open();
  }

  private redirect(): void {
    // Back to the page the expired session was kicked out of, when we know it —
    // validated (internal path, not an auth page) so a stale or pasted returnUrl
    // can't bounce a freshly signed-in user back into the auth flows.
    const target = safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
    this.router.navigateByUrl(target ?? defaultRouteFor(this.auth.user()));
  }
}
