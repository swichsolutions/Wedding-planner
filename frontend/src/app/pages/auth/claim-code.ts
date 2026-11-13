import { Component, ElementRef, Injector, OnDestroy, afterNextRender, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Meta } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService, ClaimCodeInfo } from '../../core/auth.service';
import { categoryKey } from '../../core/catalog';
import { focusFirstInvalid, passwordChecks, passwordValidator } from '../../core/forms';
import { pageTitle } from '../../core/page-title';

type Stage = 'enter' | 'checking' | 'found' | 'invalid';

/**
 * A vendor takes over the profile an admin made for them (2026-11-13). The admin sends a link
 * /kodi/K7QM-4P2X (or just the code, typed at /kodi); the page shows whose profile it is, the
 * vendor enters an email and a password, and the new account owns the profile at once. The
 * code works once and for 14 days (ClaimCodes in the API). Not for search engines: noindex,
 * and robots.txt keeps them out of /kodi.
 */
@Component({
  selector: 'app-claim-code',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  host: { class: 'theme-brand' },
  styleUrl: './register.scss',
  styles: `
    .cc-profile {
      margin-top: var(--space-4);
    }
    .cc-profile p {
      margin: 0;
    }
  `,
  template: `
    <section class="auth auth--vendor">
      <div class="auth__card">
        @switch (stage()) {
          @case ('enter') {
            <h1>{{ 'auth.code.title' | translate }}</h1>
            <p class="auth__intro">{{ 'auth.code.intro' | translate }}</p>
            <form [formGroup]="codeForm" (ngSubmit)="useCode()" novalidate>
              <div class="auth__field">
                <label for="cc-code">{{ 'auth.code.codeLabel' | translate }}</label>
                <input id="cc-code" type="text" formControlName="code" autocomplete="one-time-code"
                  autocapitalize="characters" spellcheck="false" placeholder="K7QM-4P2X" aria-required="true"
                  [class.is-invalid]="codeAttempted() && codeForm.invalid"
                  [attr.aria-invalid]="codeAttempted() && codeForm.invalid ? 'true' : null" />
                @if (codeAttempted() && codeForm.invalid) {
                  <span class="auth__err">{{ 'auth.code.codeInvalid' | translate }}</span>
                }
              </div>
              <button class="btn btn--primary" type="submit">{{ 'auth.code.codeCta' | translate }}</button>
            </form>
          }
          @case ('checking') {
            <h1>{{ 'auth.code.title' | translate }}</h1>
            <p class="auth__intro" role="status">{{ 'auth.code.checking' | translate }}</p>
          }
          @case ('invalid') {
            <h1 id="cc-invalid" tabindex="-1">{{ 'auth.code.invalidTitle' | translate }}</h1>
            <p class="auth__intro">{{ 'auth.code.invalidBody' | translate }}</p>
            <a class="btn btn--primary" routerLink="/contact">{{ 'auth.code.contact' | translate }}</a>
            <p class="auth__alt"><a routerLink="/kodi" (click)="stage.set('enter')">{{ 'auth.code.tryAgain' | translate }}</a></p>
          }
          @case ('found') {
            <h1>{{ 'auth.code.foundTitle' | translate }}</h1>
            @if (info(); as p) {
              <div class="auth__claims cc-profile">
                <p class="auth__claims-title"><strong>{{ p.name }}</strong></p>
                <p class="auth__claims-sub">{{ categoryKey(p.categorySlug) | translate }}@if (p.city) { · {{ p.city }} }</p>
              </div>
            }
            @if (signedIn()) {
              <p class="auth__intro">{{ 'auth.code.signedIn' | translate }}</p>
              <button class="btn btn--primary" type="button" (click)="signOut()">{{ 'auth.code.signOut' | translate }}</button>
            } @else {
              <p class="auth__intro">{{ 'auth.code.foundIntro' | translate }}</p>
              <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
                <div class="auth__field">
                  <label for="cc-email">{{ 'auth.email' | translate }}</label>
                  <input id="cc-email" type="email" formControlName="email" autocomplete="email" spellcheck="false" aria-required="true"
                    [class.is-invalid]="attempted() && form.controls.email.invalid"
                    [attr.aria-invalid]="attempted() && form.controls.email.invalid ? 'true' : null" />
                  @if (attempted() && form.controls.email.hasError('required')) {
                    <span class="auth__err">{{ 'auth.required' | translate }}</span>
                  } @else if (attempted() && form.controls.email.hasError('email')) {
                    <span class="auth__err">{{ 'auth.emailInvalid' | translate }}</span>
                  }
                </div>
                <div class="auth__field">
                  <label for="cc-pass">{{ 'auth.password' | translate }}</label>
                  <input id="cc-pass" type="password" formControlName="password" autocomplete="new-password" aria-required="true"
                    aria-describedby="cc-pass-reqs"
                    [class.is-invalid]="attempted() && form.controls.password.invalid"
                    [attr.aria-invalid]="attempted() && form.controls.password.invalid ? 'true' : null" />
                  @if (attempted() && form.controls.password.hasError('required')) {
                    <span class="auth__err">{{ 'auth.required' | translate }}</span>
                  } @else if (attempted() && form.controls.password.hasError('password')) {
                    <span class="auth__err">{{ 'auth.pwReqNotMet' | translate }}</span>
                  }
                  <ul id="cc-pass-reqs" class="pw-reqs" aria-live="polite"
                    [class.is-checking]="attempted() && form.controls.password.hasError('password')">
                    <li class="pw-req" [class.is-met]="pwChecks().length">{{ 'auth.pwReqLength' | translate }}</li>
                    <li class="pw-req" [class.is-met]="pwChecks().upper">{{ 'auth.pwReqUpper' | translate }}</li>
                    <li class="pw-req" [class.is-met]="pwChecks().lower">{{ 'auth.pwReqLower' | translate }}</li>
                    <li class="pw-req" [class.is-met]="pwChecks().digit">{{ 'auth.pwReqDigit' | translate }}</li>
                  </ul>
                </div>
                @if (error()) {
                  <p class="auth__error" role="alert">{{ error()! | translate }}</p>
                }
                <button class="btn btn--primary" type="submit" [disabled]="saving()">{{ 'auth.code.submit' | translate }}</button>
              </form>
              <p class="auth__alt">
                {{ 'auth.haveAccount' | translate }} <a routerLink="/login">{{ 'auth.login' | translate }}</a>
              </p>
            }
          }
        }
      </div>
    </section>
  `,
})
export class ClaimCode implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly meta = inject(Meta);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly injector = inject(Injector);

  protected readonly categoryKey = categoryKey;
  /** The server renders the start; the code is checked in the browser (the lookup is rate-limited per visitor). */
  protected readonly stage = signal<Stage>('enter');
  protected readonly info = signal<ClaimCodeInfo | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly attempted = signal(false);
  protected readonly codeAttempted = signal(false);
  protected readonly signedIn = () => !!this.auth.user();
  private code = '';

  protected readonly codeForm = this.fb.group({
    // 8 letters and digits, with or without the dash and spaces
    code: ['', [Validators.required, Validators.pattern(/^\s*[A-Za-z0-9]{4}[\s-]?[A-Za-z0-9]{4}\s*$/)]],
  });

  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, passwordValidator()]],
  });

  constructor() {
    pageTitle('auth.code.title');
    this.meta.updateTag({ name: 'robots', content: 'noindex' });
    // The address carries the code: don't hand it to another site as a Referer.
    this.meta.updateTag({ name: 'referrer', content: 'no-referrer' });

    inject(ActivatedRoute)
      .paramMap.pipe(takeUntilDestroyed())
      .subscribe((params) => {
        this.code = params.get('code') ?? '';
        if (!this.code) {
          this.stage.set('enter');
          return;
        }
        this.stage.set('checking');
        afterNextRender(() => this.check(), { injector: this.injector });
      });
  }

  ngOnDestroy(): void {
    this.meta.removeTag('name="referrer"');
  }

  protected pwChecks() {
    return passwordChecks(this.form.controls.password.value ?? '');
  }

  /** A typed code: go to its own address, which checks it. */
  protected useCode(): void {
    if (this.codeForm.invalid) {
      this.codeAttempted.set(true);
      focusFirstInvalid(this.host.nativeElement);
      return;
    }
    const raw = (this.codeForm.getRawValue().code ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    this.router.navigate(['/kodi', `${raw.slice(0, 4)}-${raw.slice(4)}`]);
  }

  protected signOut(): void {
    this.auth.logout();
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
    const v = this.form.getRawValue();
    this.auth.registerVendor({ email: v.email!, password: v.password!, claimCode: this.code }).subscribe({
      next: () => this.router.navigateByUrl('/dashboard'),
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        if (err.status === 404) this.showInvalid(); // used or expired meanwhile
        else this.error.set(err.status === 429 ? 'pwReset.tooMany' : 'auth.registerError');
      },
    });
  }

  private check(): void {
    this.auth.claimCodeInfo(this.code).subscribe({
      next: (info) => {
        this.info.set(info);
        this.stage.set('found');
      },
      error: () => this.showInvalid(),
    });
  }

  private showInvalid(): void {
    this.stage.set('invalid');
    afterNextRender(() => (this.host.nativeElement.querySelector('#cc-invalid') as HTMLElement | null)?.focus(), {
      injector: this.injector,
    });
  }
}
