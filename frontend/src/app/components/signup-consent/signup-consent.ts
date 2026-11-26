import { Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * What every sign-up form shows above its button (couple, vendor, vendor with a code):
 * the optional "send me news by e-mail" box and the sentence about the terms.
 *
 * The box is never pre-ticked and has nothing to do with the terms sentence: consent to
 * marketing mail has to be the person's own, separate choice (Beka, 2026-11-26). The account
 * page has the same choice as a switch. The links open in a new tab, so a half-filled form stays.
 */
@Component({
  selector: 'app-signup-consent',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  template: `
    <label class="consent__news">
      <input type="checkbox" [formControl]="news()" />
      <span>{{ 'consent.news' | translate }}</span>
    </label>
    <p class="consent__terms">
      {{ 'consent.agree' | translate }}
      <a routerLink="/terms" target="_blank" rel="noopener">{{ 'consent.termsLink' | translate }}</a>
      {{ 'consent.and' | translate }}
      <a routerLink="/privacy" target="_blank" rel="noopener">{{ 'consent.privacyLink' | translate }}</a>.
    </p>
  `,
  styles: `
    // On the sign-up pages the whole card has to fit one screen (styles/_components.scss,
    // section.auth), so this block is small and its spacing follows the window's height too.
    :host {
      display: block;
      margin-bottom: clamp(0.375rem, 1.2vh, 1rem);
      color: var(--color-text-secondary);
    }

    .consent__news {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-height: 24px;
      font-size: var(--fs-caption);
      line-height: 1.3;
      color: var(--color-text);
      cursor: pointer;

      input {
        flex: none;
        width: 16px;
        height: 16px;
        margin: 0;
        accent-color: var(--color-action);
        cursor: pointer;
      }
    }

    .consent__terms {
      margin: clamp(0rem, 0.3vh, 0.375rem) 0 0;
      font-size: 0.75rem;
      line-height: 1.35;
      text-wrap: balance; // two even lines where it does not fit one, no lone last word

      a {
        color: inherit;
        text-decoration: underline;
        text-underline-offset: 2px;

        &:hover {
          color: var(--color-action);
        }
      }
    }
  `,
})
export class SignupConsent {
  /** The form's own control for the news box (false until the person ticks it). */
  readonly news = input.required<FormControl<boolean | null>>();
}
