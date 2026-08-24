import { Component, ElementRef, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AuthService, defaultRouteFor, safeReturnUrl } from '../../core/auth.service';
import { focusFirstInvalid } from '../../core/forms';

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
          </div>
          @if (error()) {
            <p class="auth__error" role="alert">{{ 'auth.invalidCredentials' | translate }}</p>
          }
          <button class="btn btn--pink" type="submit" [disabled]="loading()">
            {{ 'auth.signIn' | translate }}
          </button>
        </form>
        <p class="auth__alt">
          {{ 'auth.noAccount' | translate }} <a routerLink="/signup">{{ 'auth.signUp' | translate }}</a>
        </p>
      </div>
    </section>
  `,
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly error = signal(false);
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
    const t = inject(TranslateService);
    inject(Title).setTitle(`${t.instant('auth.loginTitle')} | ${t.instant('brand.name')}`);

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
    this.error.set(false);
    const { email, password } = this.form.getRawValue();
    this.auth.login(email!, password!).subscribe({
      next: () => this.redirect(),
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  private redirect(): void {
    // Back to the page the expired session was kicked out of, when we know it —
    // validated (internal path, not an auth page) so a stale or pasted returnUrl
    // can't bounce a freshly signed-in user back into the auth flows.
    const target = safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
    this.router.navigateByUrl(target ?? defaultRouteFor(this.auth.user()));
  }
}
