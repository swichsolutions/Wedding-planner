import { Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { cityDisplayEn } from '../../core/city-name';
import { LanguageService } from '../../i18n/language.service';
import { Vendor } from '../../core/vendor.models';
import { WishlistService } from '../../core/wishlist.service';
import { BudgetVendorsService } from '../../core/budget-vendors.service';
import { AuthService } from '../../core/auth.service';
import { formatGel } from '../../core/money';

/** Photo-forward vendor card — the workhorse pattern reused on home + browse. */
@Component({
  selector: 'app-vendor-card',
  imports: [RouterLink, TranslatePipe],
  templateUrl: './vendor-card.html',
  styleUrl: './vendor-card.scss',
})
export class VendorCard {
  readonly vendor = input.required<Vendor>();
  /** In the first row of a list: the photo shouldn't wait for the scroll. */
  readonly eager = input(false);
  /** The list's first card: its photo is likely the page's largest picture, so it loads first. */
  readonly priority = input(false);

  private readonly lang = inject(LanguageService);
  private readonly translate = inject(TranslateService);
  protected readonly cityLabel = computed(() => {
    const v = this.vendor();
    return this.lang.current() === 'en' && v.citySlug ? cityDisplayEn(v.citySlug) : v.city;
  });
  /** The profile link's tooltip: what the name alone doesn't say (category and city). */
  protected readonly linkTitle = computed(() => {
    const v = this.vendor();
    void this.lang.current();
    const where = [this.translate.instant(v.categoryKey), this.cityLabel()].filter(Boolean).join(', ');
    return where ? `${v.name} — ${where}` : v.name;
  });
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  protected readonly wishlist = inject(WishlistService);
  protected readonly budgetVendors = inject(BudgetVendorsService);

  /** Couples only — the badge means nothing to a guest or a vendor/admin browsing. */
  protected readonly inBudget = computed(
    () => this.auth.isCouple() && this.budgetVendors.hasVendor(this.vendor().id),
  );

  /**
   * Guests see the heart (it routes to couple sign-up); couples use it. A
   * signed-in vendor/admin gets no heart at all — wishlists are a couple
   * feature, and sending them to /signup just bounces them straight back to
   * their own dashboard (a confusing teleport).
   */
  protected readonly showSave = computed(() => !this.auth.user() || this.auth.isCouple());

  protected toggleSave(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    // Saving is a couple-account feature — send everyone else to couple sign-up first,
    // remembering the vendor and the page: they come back here with it saved.
    if (!this.auth.isCouple()) {
      this.wishlist.rememberSave(this.vendor().id);
      this.router.navigate(['/signup'], {
        queryParams: { returnUrl: this.router.url },
      });
      return;
    }

    this.wishlist.toggle(this.vendor().id);
  }

  protected formatPrice(amount: number): string {
    return formatGel(amount, this.lang.current());
  }
}
