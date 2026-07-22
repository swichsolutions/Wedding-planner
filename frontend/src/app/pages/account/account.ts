import { Component, ElementRef, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Meta, Title } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AccountInfo, AccountService } from '../../core/account.service';
import { AuthService } from '../../core/auth.service';
import { focusFirstInvalid, passwordChecks, passwordValidator } from '../../core/forms';

/** New + confirm password must match. Emptiness is left to Validators.required per field. */
function passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
  const np = group.get('newPassword')?.value;
  const cp = group.get('confirmPassword')?.value;
  return np && cp && np !== cp ? { mismatch: true } : null;
}

/**
 * Account settings for any signed-in user (couple/vendor/admin): view the account and
 * change — or, for Google-only accounts, set — the sign-in password. Auth is browser-only,
 * so the server renders a loading shell (noindex); data loads on the client.
 */
@Component({
  selector: 'app-account',
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './account.html',
  styleUrl: './account.scss',
})
export class Account implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly accountApi = inject(AccountService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly account = signal<AccountInfo | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);

  /** Set on a failed submit — reveals the inline validation messages. */
  protected readonly attempted = signal(false);
  protected readonly saving = signal(false);
  protected readonly success = signal(false);
  protected readonly currentError = signal(false); // wrong current password
  protected readonly saveError = signal(false); // anything else

  protected readonly form = this.fb.group(
    {
      currentPassword: [''],
      newPassword: ['', [Validators.required, passwordValidator()]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: [passwordsMatchValidator] },
  );

  constructor() {
    const t = inject(TranslateService);
    inject(Title).setTitle(`${t.instant('account.title')} | ${t.instant('brand.name')}`);
    inject(Meta).updateTag({ name: 'robots', content: 'noindex' });

    // Clear transient result banners as soon as the user edits anything (real edits only —
    // programmatic resets below pass emitEvent:false so a success message survives).
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.success()) this.success.set(false);
      if (this.currentError()) this.currentError.set(false);
      if (this.saveError()) this.saveError.set(false);
    });
  }

  ngOnInit(): void {
    if (!this.isBrowser) return; // token lives in localStorage; load on the client
    this.accountApi.getAccount().subscribe({
      next: (a) => {
        this.account.set(a);
        if (a.hasPassword) this.requireCurrentPassword();
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
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
    this.success.set(false);
    this.currentError.set(false);
    this.saveError.set(false);

    const hasPw = this.account()?.hasPassword ?? true;
    const v = this.form.getRawValue();
    this.accountApi
      .changePassword({
        currentPassword: hasPw ? v.currentPassword : null,
        newPassword: v.newPassword!,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.attempted.set(false);
          this.form.reset(
            { currentPassword: '', newPassword: '', confirmPassword: '' },
            { emitEvent: false },
          );
          this.success.set(true);
          // A first-time (Google) password now exists → future changes need the current one.
          const acc = this.account();
          if (acc && !acc.hasPassword) {
            this.account.set({ ...acc, hasPassword: true });
            this.requireCurrentPassword();
          }
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          if (err.status === 400 && err.error?.code === 'current_incorrect') {
            this.currentError.set(true);
            (this.host.nativeElement.querySelector('#a-current') as HTMLElement | null)?.focus();
          } else {
            this.saveError.set(true);
          }
        },
      });
  }

  protected signOut(): void {
    this.auth.logout();
    this.router.navigateByUrl('/');
  }

  private requireCurrentPassword(): void {
    this.form.controls.currentPassword.addValidators(Validators.required);
    this.form.controls.currentPassword.updateValueAndValidity({ emitEvent: false });
  }
}
