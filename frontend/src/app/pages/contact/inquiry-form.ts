import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, Injector, afterNextRender, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

import { ContactService } from '../../core/contact.service';
import { focusFirstInvalid, notBlank, trimmedMinLength } from '../../core/forms';

type SendState = 'idle' | 'sending' | 'sent' | 'error' | 'tooMany';

/**
 * The inquiry form on /contact (review of 2026-11-12). The API mails the message to the site
 * inbox and stores nothing, so a failed send is shown as a failure with the address to write to.
 *
 * Keyboard focus is kept through every change of state: the send button is never truly
 * disabled (a disabled button drops focus to the top of the page), the confirmation takes
 * focus when it replaces the form, and "send another" hands it to the first field.
 */
@Component({
  selector: 'app-inquiry-form',
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './inquiry-form.html',
  styleUrl: './inquiry-form.scss',
})
export class InquiryForm {
  private readonly fb = inject(FormBuilder);
  private readonly contact = inject(ContactService);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly injector = inject(Injector);

  protected readonly state = signal<SendState>('idle');
  /** Set on a failed submit: shows the messages of fields that were never touched. */
  protected readonly attempted = signal(false);

  // Lengths mirror the server's ContactInquiryDto and are checked on the trimmed text, which
  // is what gets sent: so a too-short or too-long entry fails here with its own message
  // instead of a bare 400 from the API.
  protected readonly form = this.fb.nonNullable.group({
    name: ['', [notBlank, trimmedMinLength(2), Validators.maxLength(200)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(256)]],
    phone: ['', [Validators.maxLength(40)]],
    message: ['', [notBlank, trimmedMinLength(5), Validators.maxLength(4000)]],
    website: [''], // honeypot, see the template
  });

  protected invalid(name: 'name' | 'email' | 'message'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (this.attempted() || c.touched);
  }

  protected submit(): void {
    if (this.state() === 'sending') return; // the button stays focusable while sending
    if (this.form.invalid) {
      this.attempted.set(true);
      this.form.markAllAsTouched();
      focusFirstInvalid(this.host.nativeElement);
      return;
    }

    this.state.set('sending');
    const v = this.form.getRawValue();
    this.contact
      .send({
        name: v.name.trim(),
        email: v.email.trim(),
        phone: v.phone.trim() || undefined,
        message: v.message.trim(),
        website: v.website || undefined,
      })
      .subscribe({
        next: () => {
          this.form.reset();
          this.attempted.set(false);
          this.state.set('sent');
          this.focusWhenRendered('.iq-done__title');
        },
        // 429: the per-address limit; anything else (503 when the mail could not go out, a
        // dropped connection) is "could not send"
        error: (err: HttpErrorResponse) => this.state.set(err.status === 429 ? 'tooMany' : 'error'),
      });
  }

  protected again(): void {
    this.state.set('idle');
    this.focusWhenRendered('#iq-name');
  }

  /** Focus an element of this form once the template has caught up with the new state. */
  private focusWhenRendered(selector: string): void {
    afterNextRender(
      () => (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>(selector)?.focus(),
      { injector: this.injector },
    );
  }
}
