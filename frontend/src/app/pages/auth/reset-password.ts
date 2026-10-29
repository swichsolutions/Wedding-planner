import {
  Component,
  ElementRef,
  Injector,
  OnDestroy,
  afterNextRender,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Meta, Title } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AuthService, defaultRouteFor } from '../../core/auth.service';
import {
  focusFirstInvalid,
  passwordChecks,
  passwordValidator,
  passwordsMatchValidator,
} from '../../core/forms';
import { ToastService } from '../../core/toast.service';

/**
 * Step 2 of "forgot password": the emailed link lands here with ?uid=&token=. Setting the new
 * password also signs the user in. An expired, used or mangled link gets a clear dead end with
 * a way to request a fresh one.
 */
@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  host: { class: 'theme-brand' },
  styleUrl: './password-reset.scss',
  template: `
    <section class="auth">
      <div class="auth__card">
        @if (linkInvalid()) {
          <h1 id="rp-invalid" tabindex="-1">{{ 'pwReset.invalidTitle' | translate }}</h1>
          <p class="auth__intro">{{ 'pwReset.invalidBody' | translate }}</p>
          <a class="btn btn--primary" routerLink="/forgot-password">{{ 'pwReset.requestNew' | translate }}</a>
        } @else {
          <h1>{{ 'pwReset.resetTitle' | translate }}</h1>
          <p class="auth__intro">{{ 'pwReset.resetIntro' | translate }}</p>
          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <div class="auth__field">
              <label for="rp-new">{{ 'account.newPw' | translate }}</label>
              <input id="rp-new" type="password" formControlName="newPassword"
                autocomplete="new-password" aria-required="true" aria-describedby="rp-new-reqs"
                [class.is-invalid]="attempted() && form.controls.newPassword.invalid"
                [attr.aria-invalid]="attempted() && form.controls.newPassword.invalid ? 'true' : null" />
              @if (attempted() && form.controls.newPassword.hasError('required')) {
                <span class="auth__err">{{ 'auth.required' | translate }}</span>
              } @else if (attempted() && form.controls.newPassword.hasError('password')) {
                <span class="auth__err">{{ 'auth.pwReqNotMet' | translate }}</span>
              }
              <ul id="rp-new-reqs" class="pw-reqs" aria-live="polite"
                [class.is-checking]="attempted() && form.controls.newPassword.hasError('password')">
                <li class="pw-req" [class.is-met]="pwChecks().length">{{ 'auth.pwReqLength' | translate }}</li>
                <li class="pw-req" [class.is-met]="pwChecks().upper">{{ 'auth.pwReqUpper' | translate }}</li>
                <li class="pw-req" [class.is-met]="pwChecks().lower">{{ 'auth.pwReqLower' | translate }}</li>
                <li class="pw-req" [class.is-met]="pwChecks().digit">{{ 'auth.pwReqDigit' | translate }}</li>
              </ul>
            </div>

            <div class="auth__field">
              <label for="rp-confirm">{{ 'account.confirmPw' | translate }}</label>
              <input id="rp-confirm" type="password" formControlName="confirmPassword"
                autocomplete="new-password" aria-required="true"
                [class.is-invalid]="attempted() && (form.controls.confirmPassword.invalid || form.hasError('mismatch'))"
                [attr.aria-invalid]="attempted() && (form.controls.confirmPassword.invalid || form.hasError('mismatch')) ? 'true' : null" />
              @if (attempted() && form.controls.confirmPassword.hasError('required')) {
                <span class="auth__err">{{ 'auth.required' | translate }}</span>
              } @else if (attempted() && form.hasError('mismatch')) {
                <span class="auth__err">{{ 'account.pwMismatch' | translate }}</span>
              }
            </div>

            @if (error()) {
              <p class="auth__error" role="alert">{{ error()! | translate }}</p>
            }
            <button class="btn btn--primary" type="submit" [disabled]="saving()">
              {{ 'pwReset.saveCta' | translate }}
            </button>
          </form>
        }
      </div>
    </section>
  `,
})
export class ResetPassword implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly meta = inject(Meta);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly injector = inject(Injector);

  private readonly userId: string;
  private readonly token: string;

  protected readonly linkInvalid = signal(false);
  protected readonly saving = signal(false);
  /** i18n key of the failure banner, or null. */
  protected readonly error = signal<string | null>(null);
  /** Set on a failed submit — reveals the inline validation messages. */
  protected readonly attempted = signal(false);

  protected readonly form = this.fb.group(
    {
      newPassword: ['', [Validators.required, passwordValidator()]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: [passwordsMatchValidator] },
  );

  constructor() {
    const t = inject(TranslateService);
    inject(Title).setTitle(`${t.instant('pwReset.resetTitle')} | ${t.instant('brand.name')}`);
    this.meta.updateTag({ name: 'robots', content: 'noindex' });
    // The URL carries a live reset token — don't hand it to any other site as a Referer.
    this.meta.updateTag({ name: 'referrer', content: 'no-referrer' });

    const params = inject(ActivatedRoute).snapshot.queryParamMap;
    this.userId = params.get('uid') ?? '';
    this.token = params.get('token') ?? '';
    this.linkInvalid.set(!this.userId || !this.token);

    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.error()) this.error.set(null);
    });
  }

  ngOnDestroy(): void {
    this.meta.removeTag('name="referrer"');
  }

  /** Live per-rule state for the new-password requirements checklist. */
  protected pwChecks() {
    return passwordChecks(this.form.controls.newPassword.value ?? '');
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.attempted.set(true);
      this.form.markAllAsTouched();
      focusFirstInvalid(this.host.nativeElement);
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.auth.resetPassword(this.userId, this.token, this.form.getRawValue().newPassword!).subscribe({
      next: () => {
        this.toast.success('pwReset.savedToast');
        this.router.navigateByUrl(defaultRouteFor(this.auth.sessionUser()));
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        if (err.status === 400 && err.error?.code === 'invalid_token') {
          this.linkInvalid.set(true);
          afterNextRender(
            () => (this.host.nativeElement.querySelector('#rp-invalid') as HTMLElement | null)?.focus(),
            { injector: this.injector },
          );
        } else {
          this.error.set(err.status === 429 ? 'pwReset.tooMany' : 'pwReset.error');
        }
      },
    });
  }
}
