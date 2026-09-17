import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { VendorCard } from '../../components/vendor-card/vendor-card';
import { WeddingSite } from '../../components/wedding-site/wedding-site';
import { AuthService } from '../../core/auth.service';
import { VendorService } from '../../core/vendor.service';
import { Vendor } from '../../core/vendor.models';
import { CATEGORIES, img } from '../../core/catalog';
import { BUDGET_CATEGORIES, suggestedAllocation } from '../../core/budget';
import { WeddingSiteData } from '../../core/website.service';
import { LanguageService } from '../../i18n/language.service';

// Sample total for the home-page allocation preview (GEL).
const SAMPLE_BUDGET = 20000;
const PREVIEW_ROWS = 5;

// The home page shows only the highest-intent categories (2×4 on desktop) with an
// "all categories" link; the full list lives on /vendors. Order = booking priority.
const HOME_CATEGORY_SLUGS = [
  'fotografi', 'darbazi', 'videografi', 'musika',
  'kaba', 'makiaji', 'dekori', 'torti',
];

// Uniform editorial grid: every tile is a full-bleed photo with the title on a
// scrim; videographers get a looping clip (naturally) inside the same chrome.
type CardVariant = 'photo' | 'video';

interface GuideCard {
  tagKey: string;
  titleKey: string;
  img: string;
}

@Component({
  selector: 'app-home',
  imports: [RouterLink, TranslatePipe, VendorCard, WeddingSite],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  protected readonly categories = HOME_CATEGORY_SLUGS.map((slug) => ({
    ...CATEGORIES.find((c) => c.slug === slug)!,
    tagKey: 'categoryTag.' + slug,
    variant: (slug === 'videografi' ? 'video' : 'photo') as CardVariant,
  }));

  // Looping clip covering the videographers tile; the montage below runs
  // underneath as the loading/reduced-motion fallback.
  protected readonly categoryClip = '/media/videografi.mp4';
  protected readonly videoMontage = [
    img('photo-1583939003579-730e3918a45a', 600), // couple at the ceremony
    img('photo-1492691527719-9d1e07e534b4', 600), // videographer at work
    img('photo-1606800052052-a08af7148866', 600), // couple portrait by the sea
  ];

  private readonly lang = inject(LanguageService);
  private readonly auth = inject(AuthService);
  private readonly translate = inject(TranslateService);

  // Sample site for the website-promo browser frame — rendered by the REAL
  // <app-wedding-site> component (seaside design, thumb mode), same mechanism as
  // the builder's design gallery. Next-year date keeps the countdown alive.
  protected readonly siteSample = computed<WeddingSiteData>(() => {
    this.lang.current(); // recompute names/place when the language switches
    return {
      firstName: this.translate.instant('homeWebsite.sampleFirst'),
      partnerFirstName: this.translate.instant('homeWebsite.samplePartner'),
      weddingDate: `${new Date().getFullYear() + 1}-06-15`,
      place: this.translate.instant('homeWebsite.samplePlace'),
      message: null,
      inkColor: null,
      accentColor: null,
      photoUrl: img('photo-1583939003579-730e3918a45a', 900),
      photoFocusX: null,
      photoFocusY: null,
    };
  });

  // Hero CTA follows the visitor: guests are asked to sign up; signed-in users are
  // taken to their own surface instead of a registration page they can't use.
  protected readonly heroCta = computed<{ link: string; key: string }>(() => {
    if (this.auth.isCouple()) return { link: '/planning', key: 'home.ctaCouple' };
    if (this.auth.isVendor()) return { link: '/dashboard', key: 'home.ctaVendor' };
    if (this.auth.isAdmin()) return { link: '/admin', key: 'home.ctaAdmin' };
    return { link: '/signup', key: 'home.cta' };
  });

  // Two marquee rows, 8 vendors each: "Popular" = most-viewed (VendorStat data),
  // "VIP" = the paid-placement is_featured flag (dormant monetization plumbing).
  private readonly vendorSvc = inject(VendorService);

  protected readonly popular = toSignal(this.vendorSvc.popular(8), {
    initialValue: [] as Vendor[],
  });
  protected readonly vip = toSignal(this.vendorSvc.featured(8), {
    initialValue: [] as Vendor[],
  });

  // Marquee track = the vendors twice, so the -50% translate loops seamlessly.
  // The duplicate set is aria-hidden in the template.
  protected readonly popularTrack = computed(() => this.doubled(this.popular()));
  protected readonly vipTrack = computed(() => this.doubled(this.vip()));

  private doubled(vendors: Vendor[]): Vendor[] {
    return vendors.length ? [...vendors, ...vendors] : vendors;
  }

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
