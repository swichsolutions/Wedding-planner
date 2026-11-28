import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * "I'm planning a wedding | I'm a vendor": the two sign-ups as one switch, at the top of both
 * sign-up cards. Before 2026-11-28 the vendor sign-up was a small line at the very bottom of the
 * couple's card and of the sign-in window, and a tester told to "register as a vendor" could not
 * find it: the header's only "register" button opens the couple's form. Whoever lands on the
 * wrong form now sees the other one at eye level.
 *
 * Two links, not tabs: each half is its own page (/signup, /register).
 */
@Component({
  selector: 'app-signup-role',
  imports: [RouterLink, TranslatePipe],
  template: `
    <nav class="role" [attr.aria-label]="'role.label' | translate">
      <a routerLink="/signup" queryParamsHandling="preserve" [attr.aria-current]="current() === 'couple' ? 'page' : null">
        {{ 'role.couple' | translate }}
      </a>
      <a routerLink="/register" [attr.aria-current]="current() === 'vendor' ? 'page' : null">
        {{ 'role.vendor' | translate }}
      </a>
    </nav>
  `,
  styles: `
    // The sign-up cards have to fit one screen (styles/_components.scss, section.auth), so the
    // switch is low and the gap under it follows the window's height.
    .role {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3px;
      padding: 3px;
      margin-bottom: clamp(0.375rem, 1.3vh, 1.25rem);
      border-radius: var(--radius-pill);
      background: var(--paper-deep, #f0ece6);
    }

    a {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: clamp(28px, 3.9vh, 38px);
      padding-inline: var(--space-3);
      border-radius: var(--radius-pill);
      font-size: var(--fs-caption);
      font-weight: var(--fw-medium);
      line-height: 1.2;
      text-align: center;
      text-decoration: none;
      color: var(--color-text-secondary);
      transition: color var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out);

      &:hover {
        color: var(--ink);
      }

      &[aria-current='page'] {
        background: var(--paper-white, #fff);
        color: var(--ink);
        font-weight: var(--fw-semibold);
        box-shadow: var(--shadow-xs);
      }
    }

    // phones: nothing has to fit one screen there, and a finger needs more room
    @media (max-width: 1023.98px) {
      a {
        min-height: 40px;
        padding-inline: var(--space-1); // a half is 125-140px on a phone; on the narrowest the longer one takes two lines
      }
    }
  `,
})
export class SignupRole {
  /** Which of the two sign-ups this card is. */
  readonly current = input.required<'couple' | 'vendor'>();
}
