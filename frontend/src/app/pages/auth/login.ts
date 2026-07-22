import { Component, ElementRef, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../core/auth.service';
import { focusFirstInvalid } from '../../core/forms';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  template: `
    <section class="auth">
      <div class="auth__card">
        <h1>{{ 'auth.loginTitle' | translate }}</h1>
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
  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly error = signal(false);
  protected readonly loading = signal(false);
  /** Set on a failed submit — reveals the inline email/password validation messages. */
  protected readonly attempted = signal(false);

  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  constructor() {
    const t = inject(TranslateService);
    inject(Title).setTitle(`${t.instant('auth.loginTitle')} | ${t.instant('brand.name')}`);
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
    const roles = this.auth.user()?.roles ?? [];
    const target = roles.includes('Admin')
      ? '/admin'
      : roles.includes('Vendor')
        ? '/dashboard'
        : roles.includes('Couple')
          ? '/planning'
          : '/';
    this.router.navigateByUrl(target);
  }
}
