import { Component, ElementRef, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../core/auth.service';
import { focusFirstInvalid, passwordChecks, passwordValidator } from '../../core/forms';

@Component({
  selector: 'app-join',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  template: `
    <section class="auth">
      <h1>{{ 'join.title' | translate }}</h1>
      <p class="auth__intro">{{ (reason() === 'save' ? 'join.saveSubtitle' : 'join.subtitle') | translate }}</p>
      <div class="auth__card">
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="auth__field">
            <label for="j-name">{{ 'join.name' | translate }}</label>
            <input id="j-name" type="text" formControlName="name" autocomplete="name" />
          </div>
          <div class="auth__field">
            <label for="j-email">{{ 'auth.email' | translate }}</label>
            <input id="j-email" type="email" formControlName="email" autocomplete="email"
              spellcheck="false" aria-required="true"
              [class.is-invalid]="attempted() && form.controls.email.invalid"
              [attr.aria-invalid]="attempted() && form.controls.email.invalid ? 'true' : null" />
            @if (attempted() && form.controls.email.hasError('required')) {
              <span class="auth__err">{{ 'auth.required' | translate }}</span>
            } @else if (attempted() && form.controls.email.hasError('email')) {
              <span class="auth__err">{{ 'auth.emailInvalid' | translate }}</span>
            }
          </div>
          <div class="auth__field">
            <label for="j-pass">{{ 'auth.password' | translate }}</label>
            <input id="j-pass" type="password" formControlName="password" autocomplete="new-password"
              aria-required="true" aria-describedby="j-pass-reqs"
              [class.is-invalid]="attempted() && form.controls.password.invalid"
              [attr.aria-invalid]="attempted() && form.controls.password.invalid ? 'true' : null" />
            @if (attempted() && form.controls.password.hasError('required')) {
              <span class="auth__err">{{ 'auth.required' | translate }}</span>
            } @else if (attempted() && form.controls.password.hasError('password')) {
              <span class="auth__err">{{ 'auth.pwReqNotMet' | translate }}</span>
            }
            <ul id="j-pass-reqs" class="pw-reqs" aria-live="polite"
              [class.is-checking]="attempted() && form.controls.password.hasError('password')">
              <li class="pw-req" [class.is-met]="pwChecks().length">{{ 'auth.pwReqLength' | translate }}</li>
              <li class="pw-req" [class.is-met]="pwChecks().upper">{{ 'auth.pwReqUpper' | translate }}</li>
              <li class="pw-req" [class.is-met]="pwChecks().lower">{{ 'auth.pwReqLower' | translate }}</li>
              <li class="pw-req" [class.is-met]="pwChecks().digit">{{ 'auth.pwReqDigit' | translate }}</li>
            </ul>
          </div>
          @if (error()) {
            <p class="auth__error" role="alert">{{ 'join.error' | translate }}</p>
          }
          <button class="btn btn--pink" type="submit" [disabled]="loading()">
            {{ 'join.submit' | translate }}
          </button>
        </form>
        <p class="auth__alt">
          {{ 'auth.haveAccount' | translate }} <a routerLink="/login">{{ 'auth.login' | translate }}</a>
        </p>
      </div>
    </section>
  `,
})
export class Join {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly host = inject(ElementRef<HTMLElement>);

  private readonly returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
  protected readonly reason = signal(this.route.snapshot.queryParamMap.get('reason'));
  protected readonly error = signal(false);
  protected readonly loading = signal(false);
  /** Set on a failed submit — reveals the inline email/password validation messages. */
  protected readonly attempted = signal(false);

  protected readonly form = this.fb.group({
    name: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, passwordValidator()]],
  });

  constructor() {
    const t = inject(TranslateService);
    inject(Title).setTitle(`${t.instant('join.title')} | ${t.instant('brand.name')}`);
  }

  /** Live per-rule state for the password requirements checklist (updates as the user types). */
  protected pwChecks() {
    return passwordChecks(this.form.controls.password.value ?? '');
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
    const v = this.form.getRawValue();
    this.auth
      .registerCouple({ email: v.email!, password: v.password!, firstName: v.name || undefined })
      .subscribe({
        next: () => this.router.navigateByUrl(this.returnUrl || '/planning'),
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }
}
