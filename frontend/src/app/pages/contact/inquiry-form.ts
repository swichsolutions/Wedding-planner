import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

import { ContactService } from '../../core/contact.service';
import { focusFirstInvalid } from '../../core/forms';

type SendState = 'idle' | 'sending' | 'sent' | 'error' | 'tooMany';

/**
 * The inquiry form on /contact (review of 2026-11-12). The API mails the message to the site
 * inbox and stores nothing, so a failed send is shown as a failure with the address to write to.
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

  protected readonly state = signal<SendState>('idle');
  /** Set on a failed submit: shows the messages of fields that were never touched. */
  protected readonly attempted = signal(false);

  // Lengths mirror the server's ContactInquiryDto, so a long message fails here with its own
  // message instead of a bare 400. /\S/: spaces alone are not a name or a message.
  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/\S/), Validators.minLength(2), Validators.maxLength(200)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(256)]],
    phone: ['', [Validators.maxLength(40)]],
    message: ['', [Validators.required, Validators.pattern(/\S/), Validators.minLength(5), Validators.maxLength(4000)]],
    website: [''], // honeypot, see the template
  });

  protected invalid(name: 'name' | 'email' | 'message'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (this.attempted() || c.touched);
  }

  protected submit(): void {
    if (this.state() === 'sending') return;
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
        },
        // 429: the per-address limit; anything else (503 when the mail could not go out, a
        // dropped connection) is "could not send"
        error: (err: HttpErrorResponse) => this.state.set(err.status === 429 ? 'tooMany' : 'error'),
      });
  }

  protected again(): void {
    this.state.set('idle');
  }
}
