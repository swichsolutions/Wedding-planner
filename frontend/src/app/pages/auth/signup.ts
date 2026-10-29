import { Component, ElementRef, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Meta, Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AuthService, afterSignUpRoute, defaultRouteFor, safeReturnUrl } from '../../core/auth.service';
import { AuthModalService } from '../../core/auth-modal.service';
import { focusFirstInvalid, passwordChecks, passwordValidator } from '../../core/forms';
import { environment } from '../../../environments/environment';

/**
 * Couple sign-up, account first (guide §3, decision D4): email and password, or Google through
 * the sign-in window. The plan's details come next, on the start form (/planning/start), every
 * one of them skippable. Someone invited by a partner (returnUrl /partner/…) goes straight back
 * to the invitation instead: they're joining a plan that already has its details.
 */
@Component({
  selector: 'app-signup',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './signup.html',
  styleUrl: './signup.scss',
  host: { class: 'theme-brand' },
})
export class Signup {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly authModal = inject(AuthModalService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly host = inject(ElementRef<HTMLElement>);

  // Validated once at the single source, so every navigation only ever sees a safe value.
  private readonly returnUrl = safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
  /** Arrived from a partner invitation: the copy talks about joining their plan. */
  protected readonly joining = !!this.returnUrl?.startsWith('/partner/');
  protected readonly googleEnabled = !!environment.googleClientId;

  protected readonly loading = signal(false);
  protected readonly error = signal<'taken' | 'other' | null>(null);
  /** Set on a failed submit: reveals the inline validation messages. */
  protected readonly attempted = signal(false);

  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, passwordValidator()]],
  });

  constructor() {
    const t = inject(TranslateService);
    inject(Title).setTitle(`${t.instant('signup.title')} | ${t.instant('brand.name')}`);
    // A sign-up form has nothing to rank for.
    inject(Meta).updateTag({ name: 'robots', content: 'noindex' });

    // Already signed in: nothing to sign up for. (Signing in from here through the sign-in
    // window is routed by the window itself, see LoginModal.redirect.)
    const user = this.auth.sessionUser();
    if (user) {
      const target = this.returnUrl && user.roles.includes('Couple') ? this.returnUrl : defaultRouteFor(user);
      void this.router.navigateByUrl(target);
    }
  }

  /** Live per-rule state for the password requirements checklist. */
  protected pwChecks() {
    return passwordChecks(this.form.controls.password.value ?? '');
  }

  /** Google (and "I already have an account") live in the sign-in window. */
  protected openSignIn(): void {
    this.authModal.open();
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
    const v = this.form.getRawValue();
    this.auth.registerCouple({ email: v.email!.trim(), password: v.password! }).subscribe({
      next: () => {
        this.auth.consumeNewAccount();
        void this.router.navigateByUrl(afterSignUpRoute(this.returnUrl));
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(err.status === 409 ? 'taken' : 'other');
        this.loading.set(false);
      },
    });
  }
}
