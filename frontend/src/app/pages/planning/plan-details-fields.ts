import { Component, computed, input } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

import { REGIONS } from '../../core/catalog';
import { CoupleProfile, PlanDetails } from '../../core/couple.service';
import { nameValidator } from '../../core/forms';
import { GUEST_RANGES } from '../../core/onboarding';

/** The plan's details as a form: shared by the start form and the settings page. */
/** A date being typed can't be in the past. One already saved stays valid, so a plan can still be edited after the wedding. */
function notPastWhenEdited(c: AbstractControl): ValidationErrors | null {
  if (!c.dirty || !c.value) return null;
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return c.value < today ? { past: true } : null;
}

export function planDetailsForm(fb: FormBuilder) {
  return fb.group({
    firstName: ['', [nameValidator(), Validators.maxLength(120)]],
    lastName: ['', [nameValidator(), Validators.maxLength(120)]],
    partnerFirstName: ['', [nameValidator(), Validators.maxLength(120)]],
    partnerLastName: ['', [nameValidator(), Validators.maxLength(120)]],
    weddingDate: ['', [notPastWhenEdited]],
    /** „ჯერ არ ვიცი“ for the date. */
    dateUnknown: [false],
    city: ['', [Validators.maxLength(120)]],
    region: [''],
    guestCountRange: [''],
  });
}

export type PlanDetailsForm = ReturnType<typeof planDetailsForm>;

/** Fill the form from the saved plan (no date saved = „ჯერ არ ვიცი“ only once the plan has been set up). */
export function patchPlanDetails(form: PlanDetailsForm, p: CoupleProfile, dateKnownUnknown = false): void {
  form.patchValue({
    firstName: p.firstName ?? '',
    lastName: p.lastName ?? '',
    partnerFirstName: p.partnerFirstName ?? '',
    partnerLastName: p.partnerLastName ?? '',
    weddingDate: p.weddingDate ?? '',
    dateUnknown: dateKnownUnknown && !p.weddingDate,
    city: p.city ?? '',
    region: p.region ?? '',
    guestCountRange: p.guestCountRange ?? '',
  });
  setDateUnknown(form, form.controls.dateUnknown.value === true);
}

export function setDateUnknown(form: PlanDetailsForm, unknown: boolean): void {
  form.controls.dateUnknown.setValue(unknown);
  if (unknown) {
    form.controls.weddingDate.setValue('');
    form.controls.weddingDate.disable();
  } else {
    form.controls.weddingDate.enable();
  }
}

/** What to save: blanks and „ჯერ არ ვიცი“ become null. */
export function toPlanDetails(form: PlanDetailsForm): PlanDetails {
  const v = form.getRawValue();
  const t = (s: string | null | undefined) => (s ?? '').trim() || null;
  return {
    firstName: t(v.firstName),
    lastName: t(v.lastName),
    partnerFirstName: t(v.partnerFirstName),
    partnerLastName: t(v.partnerLastName),
    weddingDate: v.dateUnknown ? null : t(v.weddingDate),
    city: t(v.city),
    region: t(v.region),
    guestCountRange: t(v.guestCountRange),
  };
}

/**
 * The fields themselves: who, when, where, how many guests. Every one optional, each with a
 * „ჯერ არ ვიცი“ way out (guide §3). The person filling it in sees their own name first, whichever
 * side of the plan they are (a partner who joined is the plan's partner* name).
 */
@Component({
  selector: 'app-plan-details-fields',
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './plan-details-fields.html',
  styleUrl: './plan-details-fields.scss',
})
export class PlanDetailsFields {
  readonly form = input.required<PlanDetailsForm>();
  readonly iAmPartner = input(false);
  /** Prefix for element ids, so two forms on one page don't clash. */
  readonly idPrefix = input('pd');

  protected readonly regions = REGIONS;
  protected readonly guestRanges = GUEST_RANGES;

  /** [first, last] control names: mine, then my partner's. */
  protected readonly people = computed(() => {
    const me = { first: 'firstName', last: 'lastName' } as const;
    const partner = { first: 'partnerFirstName', last: 'partnerLastName' } as const;
    return this.iAmPartner()
      ? [{ key: 'you', ...partner }, { key: 'partner', ...me }]
      : [{ key: 'you', ...me }, { key: 'partner', ...partner }];
  });

  protected toggleDateUnknown(event: Event): void {
    setDateUnknown(this.form(), (event.target as HTMLInputElement).checked);
  }

  protected pickGuests(range: string): void {
    const c = this.form().controls.guestCountRange;
    c.setValue(c.value === range ? '' : range);
    c.markAsDirty();
  }

  protected invalid(name: string): boolean {
    const c = (this.form() as FormGroup).get(name);
    return !!c && c.invalid && (c.touched || c.dirty);
  }
}
