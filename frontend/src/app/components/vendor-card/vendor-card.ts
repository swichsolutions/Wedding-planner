import { Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

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

  private readonly lang = inject(LanguageService);
  protected readonly cityLabel = computed(() => {
    const v = this.vendor();
    return this.lang.current() === 'en' && v.citySlug ? cityDisplayEn(v.citySlug) : v.city;
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
