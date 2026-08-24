import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Move focus to the first invalid control inside a host element (WCAG focus management). */
export function focusFirstInvalid(host: HTMLElement): void {
  const el = host.querySelector(
    'input.ng-invalid, select.ng-invalid, textarea.ng-invalid',
  ) as HTMLElement | null;
  el?.focus();
}

// A person's name: at least one letter, and only letters (any script — Georgian, Latin, …),
// combining marks (\p{M} — decomposed input like "é" typed as e+U+0301 must validate),
// spaces, hyphens, apostrophes and dots. Rejects digit-only or number-containing input like "123".
const NAME_RE = /^(?=.*\p{L})[\p{L}\p{M} .'’-]+$/u;

/**
 * Validator for human name fields. Only trips when the field has (trimmed) content that isn't a
 * valid name — emptiness is left to Validators.required so "required" and "invalid" stay distinct.
 */
export function nameValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = (control.value ?? '').trim();
    if (!value) return null;
    return NAME_RE.test(value) ? null : { name: true };
  };
}

/**
 * The password rules the backend actually enforces: ASP.NET Identity with RequiredLength = 8 and
 * RequireDigit/Lowercase/Uppercase (RequireNonAlphanumeric is turned off — no symbol required). The
 * client must mirror these, or users pass here and fail server-side. Uses Unicode-aware upper/lower/
 * digit checks to match .NET's char.IsUpper/IsLower/IsDigit.
 */
export interface PasswordChecks {
  length: boolean;
  upper: boolean;
  lower: boolean;
  digit: boolean;
}

export function passwordChecks(value: string): PasswordChecks {
  return {
    length: value.length >= 8,
    upper: /\p{Lu}/u.test(value),
    lower: /\p{Ll}/u.test(value),
    digit: /\p{Nd}/u.test(value),
  };
}

/** Fails with the list of unmet rule keys; leaves emptiness to Validators.required. */
export function passwordValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: string = control.value ?? '';
    if (!value) return null;
    const checks = passwordChecks(value);
    const unmet = (Object.keys(checks) as (keyof PasswordChecks)[]).filter((k) => !checks[k]);
    return unmet.length ? { password: unmet } : null;
  };
}
