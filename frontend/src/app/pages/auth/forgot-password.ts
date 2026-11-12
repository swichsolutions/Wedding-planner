import {
  Component,
  ElementRef,
  Injector,
  OnInit,
  PLATFORM_ID,
  afterNextRender,
  effect,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Meta } from '@angular/platform-browser';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService, defaultRouteFor } from '../../core/auth.service';
import { AuthModalService } from '../../core/auth-modal.service';
import { focusFirstInvalid } from '../../core/forms';
import { pageTitle } from '../../core/page-title';
import { LanguageService } from '../../i18n/language.service';

/**
 * Step 1 of "forgot password": ask for the account email and send a reset link. The answer
 * is the same whether or not the email has an account (the API never says), so the
 * confirmation is worded "if … has an account".
 */
@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, TranslatePipe],
  host: { class: 'theme-brand' },
  styleUrl: './password-reset.scss',
  template: `
    <section class="auth">
      <div class="auth__card">
        @if (!sentTo()) {
          <h1>{{ 'pwReset.forgotTitle' | translate }}</h1>
          <p class="auth__intro">{{ 'pwReset.forgotIntro' | translate }}</p>
          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <div class="auth__field">
              <label for="fp-email">{{ 'auth.email' | translate }}</label>
              <input id="fp-email" type="email" formControlName="email" autocomplete="email"
                spellcheck="false" aria-required="true"
                [class.is-invalid]="attempted() && form.controls.email.invalid"
                [attr.aria-invalid]="attempted() && form.controls.email.invalid ? 'true' : null" />
              @if (attempted() && form.controls.email.hasError('required')) {
                <span class="auth__err">{{ 'auth.required' | translate }}</span>
              } @else if (attempted() && form.controls.email.hasError('email')) {
                <span class="auth__err">{{ 'auth.emailInvalid' | translate }}</span>
              }
            </div>
            @if (error()) {
              <p class="auth__error" role="alert">{{ error()! | translate }}</p>
            }
            <button class="btn btn--primary" type="submit" [disabled]="loading()">
              {{ 'pwReset.sendCta' | translate }}
            </button>
          </form>
        } @else {
          <h1 id="fp-sent" tabindex="-1">{{ 'pwReset.sentTitle' | translate }}</h1>
          <p class="auth__intro">{{ 'pwReset.sentBody' | translate: { email: sentTo() } }}</p>
          <p class="pr-hint">{{ 'pwReset.sentSpam' | translate }}</p>
          <button type="button" class="btn btn--ghost" (click)="again()">
            {{ 'pwReset.tryAgain' | translate }}
          </button>
        }
        <p class="auth__alt">
          <button type="button" class="pr-link" (click)="modal.open()">
            {{ 'pwReset.backToSignIn' | translate }}
          </button>
        </p>
      </div>
    </section>
  `,
})
export class ForgotPassword implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly lang = inject(LanguageService);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly injector = inject(Injector);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  protected readonly modal = inject(AuthModalService);

  protected readonly loading = signal(false);
  /** i18n key of the failure banner, or null. */
  protected readonly error = signal<string | null>(null);
  /** Set on a failed submit — reveals the inline validation messages. */
  protected readonly attempted = signal(false);
  /** The address the link went to; non-null switches to the "check your email" view. */
  protected readonly sentTo = signal<string | null>(null);

  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  constructor() {
    pageTitle('pwReset.forgotTitle');
    inject(Meta).updateTag({ name: 'robots', content: 'noindex' });

    // Signing in from here (the "back to sign in" modal) means the password came back to
    // them — move on to their workspace. Someone who arrived already signed in (to reset a
    // password they no longer know) stays.
    const startedSignedIn = !!this.auth.sessionUser();
    effect(() => {
      const user = this.auth.user();
      if (user && !startedSignedIn) this.router.navigateByUrl(defaultRouteFor(user));
    });
  }

  ngOnInit(): void {
    // The sign-in modal hands over whatever email was already typed (router state, so it
    // never lands in a URL or server log).
    if (!this.isBrowser) return;
    const email = (history.state as { email?: unknown } | null)?.email;
    if (typeof email === 'string' && email) this.form.patchValue({ email });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.attempted.set(true);
      this.form.markAllAsTouched();
      focusFirstInvalid(this.host.nativeElement);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    const email = this.form.getRawValue().email!.trim();
    this.auth.requestPasswordReset(email, this.lang.current()).subscribe({
      next: () => {
        this.loading.set(false);
        this.sentTo.set(email);
        // The form is gone — put focus on the new heading so screen readers announce it.
        afterNextRender(
          () => (this.host.nativeElement.querySelector('#fp-sent') as HTMLElement | null)?.focus(),
          { injector: this.injector },
        );
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(err.status === 429 ? 'pwReset.tooMany' : 'pwReset.error');
      },
    });
  }

  protected again(): void {
    this.sentTo.set(null);
    this.attempted.set(false);
    afterNextRender(
      () => (this.host.nativeElement.querySelector('#fp-email') as HTMLElement | null)?.focus(),
      { injector: this.injector },
    );
  }
}
