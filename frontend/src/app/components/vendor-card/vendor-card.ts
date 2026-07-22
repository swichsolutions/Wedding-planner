import { Component, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { LanguageService } from '../../i18n/language.service';
import { Vendor } from '../../core/vendor.models';
import { WishlistService } from '../../core/wishlist.service';
import { AuthService } from '../../core/auth.service';

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
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  protected readonly wishlist = inject(WishlistService);

  protected toggleSave(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    // Saving is a couple-account feature — send everyone else to couple sign-up first,
    // remembering where they were so a future sign-up page can return them here.
    if (!this.auth.isCouple()) {
      this.router.navigate(['/signup'], {
        queryParams: { returnUrl: this.router.url },
      });
      return;
    }

    this.wishlist.toggle(this.vendor().id);
  }

  protected formatPrice(amount: number): string {
    const locale = this.lang.current() === 'en' ? 'en-US' : 'ka-GE';
    return new Intl.NumberFormat(locale).format(amount) + ' ₾';
  }
}
