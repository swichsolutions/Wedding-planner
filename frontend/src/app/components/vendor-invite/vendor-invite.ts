import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../core/auth.service';

/**
 * "Are you a vendor? Add your business": shown under every catalog list (and under an empty
 * one, which is every category while the catalog is being filled). A vendor who hears about the
 * site opens their own category first, so the way in is where they are looking; before
 * 2026-11-28 it was only in the footer and in small print on the couple's sign-up.
 * The server renders it for everyone (the catalog pages are stored there, one copy per address);
 * in the browser it goes away for a signed-in vendor, who has a business here already.
 */
@Component({
  selector: 'app-vendor-invite',
  imports: [RouterLink, TranslatePipe],
  template: `
    @if (!auth.isVendor()) {
    <aside class="invite" [attr.aria-label]="'vendorInvite.title' | translate">
      <div class="invite__text">
        <h2 class="invite__title">{{ 'vendorInvite.title' | translate }}</h2>
        <p class="invite__body">{{ 'vendorInvite.body' | translate }}</p>
      </div>
      <div class="invite__actions">
        <a class="btn btn--primary" routerLink="/register">{{ 'vendorInvite.cta' | translate }}</a>
        <a class="invite__how" routerLink="/for-vendors">{{ 'vendorInvite.how' | translate }}</a>
      </div>
    </aside>
    }
  `,
  styles: `
    :host {
      display: block;
      margin-top: var(--space-12);
    }

    .invite {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-5) var(--space-8);
      padding: var(--space-6) var(--space-8);
      border: 1px solid var(--paper-line);
      border-radius: var(--radius-lg);
      background: #fff;
    }

    .invite__title {
      margin: 0 0 var(--space-1);
      font-family: var(--font-display);
      letter-spacing: var(--tracking-display);
      font-size: var(--fs-h4);
    }

    .invite__body {
      margin: 0;
      max-width: 38rem;
      line-height: 1.5;
      color: var(--color-text-secondary);
    }

    .invite__actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-3) var(--space-5);
    }

    .invite__how {
      font-weight: var(--fw-medium);
      color: var(--ink);
      text-decoration: underline;
      text-underline-offset: 3px;

      &:hover {
        color: var(--color-action);
      }
    }

    @media (max-width: 599.98px) {
      .invite {
        padding: var(--space-5);
      }

      .invite__actions,
      .invite__actions .btn {
        width: 100%;
      }
    }
  `,
})
export class VendorInvite {
  protected readonly auth = inject(AuthService);
}
