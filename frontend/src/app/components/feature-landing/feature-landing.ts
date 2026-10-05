import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../core/auth.service';

/** One "next step" card under the tips: `${prefix}.${key}Title|Text|Cta` + a route. */
export interface LandingNextLink {
  key: string;
  link: string;
}

/**
 * Public explainer for a couple-only planning tool (guest list, seating, budget).
 *
 * Each tool page serves the tool itself to a signed-in couple and this landing to
 * everyone else from the same URL, so this is the version search engines index.
 * All copy comes from i18n under `prefix` (hero*, feature{n}*, tip{n}*, faq{n}q/a,
 * next*, final*); the layout chrome (buttons, kicker, role notice) lives under
 * `featureLanding`. A page can project its own product preview into the hero via
 * `[landingPreview]`, or hide the hero altogether when it already has one.
 *
 * Signed-in vendors and admins get a short "this is for couples" notice instead of
 * sign-up buttons — the tools need the Couple role on the API side.
 */
@Component({
  selector: 'app-feature-landing',
  imports: [RouterLink, TranslatePipe],
  templateUrl: './feature-landing.html',
  styleUrl: './feature-landing.scss',
})
export class FeatureLanding {
  /** i18n key prefix, e.g. `guestListPage.landing`. */
  readonly prefix = input.required<string>();
  /** Render the hero (title, pitch, CTAs, projected preview). Off for pages with their own. */
  readonly hero = input(true);
  readonly steps = input(3);
  readonly tips = input(3);
  readonly faqs = input(5);
  readonly next = input<LandingNextLink[]>([]);
  /**
   * Optional sign-up handler. When set, the sign-up CTAs run it instead of linking to
   * /signup — the budget page uses this to carry the visitor's draft into onboarding.
   */
  readonly signupAction = input<(() => void) | null>(null);

  private readonly auth = inject(AuthService);

  /** Signed in, but not as a couple (vendor / admin). */
  protected readonly otherRole = computed(() => !!this.auth.user() && !this.auth.isCouple());
  protected readonly roleNoticeKey = computed(() =>
    this.auth.isAdmin() ? 'featureLanding.signedInAdmin' : 'featureLanding.signedInVendor',
  );

  protected range(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i + 1);
  }

  protected logout(): void {
    this.auth.logout();
  }
}
