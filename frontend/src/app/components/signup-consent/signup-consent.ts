import { Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * The two boxes every sign-up form shows above its button (couple, vendor, vendor with a code):
 *
 * 1. "I agree to the terms and the privacy policy": required, the form does not send without
 *    it (Beka, 2026-11-26: a box people tick, not a sentence they pass by). The account keeps
 *    the date (AppUser.TermsAcceptedAt).
 * 2. "Send me news and offers by e-mail": optional and never pre-ticked. Consent to marketing
 *    mail has to be the person's own, separate choice, so this box must never become required
 *    or be joined with the first one. The account page has the same choice as a switch.
 *
 * The links open in a new tab, so a half-filled form stays.
 */
@Component({
  selector: 'app-signup-consent',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  template: `
    <label class="consent__box">
      <input type="checkbox" [formControl]="terms()" aria-required="true"
        [attr.aria-invalid]="attempted() && terms().invalid ? 'true' : null"
        [attr.aria-describedby]="attempted() && terms().invalid ? 'consent-terms-err' : null" />
      <span>
        {{ 'consent.agree' | translate }}
        <a routerLink="/terms" target="_blank" rel="noopener">{{ 'consent.termsLink' | translate }}</a>
        {{ 'consent.and' | translate }}
        <a routerLink="/privacy" target="_blank" rel="noopener">{{ 'consent.privacyLink' | translate }}</a>
      </span>
    </label>
    @if (attempted() && terms().invalid) {
      <span id="consent-terms-err" class="consent__err">{{ 'consent.termsRequired' | translate }}</span>
    }
    <label class="consent__box">
      <input type="checkbox" [formControl]="news()" />
      <span>{{ 'consent.news' | translate }}</span>
    </label>
  `,
  styles: `
    // On the sign-up pages the whole card has to fit one screen (styles/_components.scss,
    // section.auth), so the two rows are small and the gap under them follows the window's height.
    :host {
      display: block;
      container-type: inline-size; // the rows' text is sized from this width
      margin-bottom: clamp(0.375rem, 1.2vh, 1rem);
    }

    .consent__box {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-height: 24px;
      // One line each on a desktop card (Beka, 2026-11-26): at 13px the Georgian terms line is a
      // few pixels wider than the card gives it, so the size follows the card's width (about
      // 12.4px there). Never under 12px: on a phone's narrower card the lines wrap instead.
      font-size: clamp(0.75rem, 3cqi, var(--fs-caption));
      line-height: 1.3;
      color: var(--color-text);
      cursor: pointer;

      input {
        flex: none;
        width: var(--consent-box, 16px);
        height: var(--consent-box, 16px);
        margin: 0;
        accent-color: var(--color-action);
        cursor: pointer;
      }

      a {
        color: inherit;
        text-decoration: underline;
        text-underline-offset: 2px;

        // text links: evergreen is for buttons, so hover only thickens the line
        &:hover {
          text-decoration-thickness: 2px;
        }
      }
    }

    // phones: the rows take two lines each there, so they need air between them (and the page
    // scrolls anyway, nothing has to fit one screen)
    @media (max-width: 1023.98px) {
      :host {
        --consent-box: 20px; // a larger box for a finger
      }

      .consent__box + .consent__box,
      .consent__err + .consent__box {
        margin-top: var(--space-2);
      }
    }

    .consent__err {
      display: block;
      margin: 0 0 2px calc(var(--consent-box, 16px) + var(--space-2)); // under the text, not under the box
      font-size: 0.75rem;
      color: var(--color-danger-600);
    }
  `,
})
export class SignupConsent {
  /** The form's control for the terms box: `[false, Validators.requiredTrue]`. */
  readonly terms = input.required<FormControl<boolean | null>>();
  /** The form's control for the news box (false until the person ticks it). */
  readonly news = input.required<FormControl<boolean | null>>();
  /** True after a failed submit: the terms box then says why the form did not send. */
  readonly attempted = input(false);
}
