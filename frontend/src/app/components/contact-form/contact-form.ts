import { Component, ElementRef, inject, input, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

import { MessageService } from '../../core/message.service';

type SendState = 'idle' | 'sending' | 'sent' | 'error';

/** At least one of phone/email must be provided so the vendor can reply. */
function contactRequired(group: AbstractControl): ValidationErrors | null {
  const phone = (group.get('phone')?.value ?? '').trim();
  const email = (group.get('email')?.value ?? '').trim();
  return phone || email ? null : { contactRequired: true };
}

@Component({
  selector: 'app-contact-form',
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './contact-form.html',
  styleUrl: './contact-form.scss',
})
export class ContactForm {
  readonly vendorId = input.required<number>();

  private readonly fb = inject(FormBuilder);
  private readonly messages = inject(MessageService);
  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly state = signal<SendState>('idle');

  // Max lengths mirror the server's CreateMessageDto caps (200/40/4000) so an
  // over-long message fails with a specific message, not a bare 400.
  protected readonly form = this.fb.group(
    {
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
      phone: ['', [Validators.maxLength(40)]],
      email: ['', [Validators.email]],
      body: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(4000)]],
    },
    { validators: contactRequired },
  );

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      // Move focus to the first invalid field (WCAG: focus management on submit).
      const firstInvalid = this.host.nativeElement.querySelector(
        'input.ng-invalid, textarea.ng-invalid',
      ) as HTMLElement | null;
      firstInvalid?.focus();
      return;
    }

    this.state.set('sending');
    const v = this.form.getRawValue();
    this.messages
      .send({
        vendorId: this.vendorId(),
        senderName: v.name?.trim() || undefined,
        senderPhone: v.phone?.trim() || undefined,
        senderEmail: v.email?.trim() || undefined,
        body: v.body?.trim() ?? '',
      })
      .subscribe({
        next: () => {
          this.state.set('sent');
          this.form.reset();
        },
        error: () => this.state.set('error'),
      });
  }

  protected showError(control: string): boolean {
    const c = this.form.get(control);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  protected get contactGroupError(): boolean {
    return !!this.form.errors?.['contactRequired'] && this.form.touched;
  }
}
