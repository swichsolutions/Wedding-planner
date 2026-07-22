import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';

import { VendorCard } from '../../components/vendor-card/vendor-card';
import { AuthService } from '../../core/auth.service';
import { VendorService } from '../../core/vendor.service';
import { Vendor } from '../../core/vendor.models';
import { CATEGORIES, img } from '../../core/catalog';
import { BUDGET_CATEGORIES, suggestedAllocation } from '../../core/budget';
import { LanguageService } from '../../i18n/language.service';

// Sample total for the home-page allocation preview (GEL).
const SAMPLE_BUDGET = 20000;
const PREVIEW_ROWS = 5;

interface GuideCard {
  tagKey: string;
  titleKey: string;
  img: string;
}

@Component({
  selector: 'app-home',
  imports: [RouterLink, TranslatePipe, VendorCard],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  protected readonly categories = CATEGORIES;

  private readonly lang = inject(LanguageService);
  private readonly auth = inject(AuthService);

  // Hero CTA follows the visitor: guests are asked to sign up; signed-in users are
  // taken to their own surface instead of a registration page they can't use.
  protected readonly heroCta = computed<{ link: string; key: string }>(() => {
    if (this.auth.isCouple()) return { link: '/planning', key: 'home.ctaCouple' };
    if (this.auth.isVendor()) return { link: '/dashboard', key: 'home.ctaVendor' };
    if (this.auth.isAdmin()) return { link: '/admin', key: 'home.ctaAdmin' };
    return { link: '/signup', key: 'home.cta' };
  });

  protected readonly featured = toSignal(inject(VendorService).featured(4), {
    initialValue: [] as Vendor[],
  });

  protected readonly sampleTotal = computed(() => this.formatGel(SAMPLE_BUDGET));

  // Top allocation rows from the real budget model; bars scaled to the largest share.
  protected readonly budgetRows = computed(() => {
    const amounts = suggestedAllocation(SAMPLE_BUDGET);
    const max = BUDGET_CATEGORIES[0].pct;
    return BUDGET_CATEGORIES.slice(0, PREVIEW_ROWS).map((c, i) => ({
      key: 'budgetCat.' + c.key,
      scale: Math.round((c.pct / max) * 100),
      amount: this.formatGel(amounts[i]),
    }));
  });

  private formatGel(amount: number): string {
    const locale = this.lang.current() === 'en' ? 'en-US' : 'ka-GE';
    return new Intl.NumberFormat(locale).format(amount) + ' ₾';
  }

  protected readonly guides: GuideCard[] = [
    { tagKey: 'guides.item1.tag', titleKey: 'guides.item1.title', img: img('photo-1537633552985-df8429e8048b', 700) },
    { tagKey: 'guides.item2.tag', titleKey: 'guides.item2.title', img: img('photo-1469371670807-013ccf25f16a', 700) },
    { tagKey: 'guides.item3.tag', titleKey: 'guides.item3.title', img: img('photo-1511285560929-80b456fea0bc', 700) },
  ];
}
