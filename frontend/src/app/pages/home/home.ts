import { Component, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
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
import {
  Budget,
  BudgetItem,
  BudgetReminder,
  BudgetService,
  reminderStatus,
} from '../../core/budget.service';
import { ChecklistItem, ChecklistService } from '../../core/checklist.service';
import { CoupleProfile, CoupleService } from '../../core/couple.service';
import { Guest, GuestService } from '../../core/guest.service';
import { SeatingState, SeatingService } from '../../core/seating.service';
import { WishlistService } from '../../core/wishlist.service';
import {
  WeddingSite as WeddingSiteRecord,
  WeddingSiteData,
  WebsiteService,
} from '../../core/website.service';
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

  // ===================== COUPLE OVERVIEW (signed-in couple) =====================
  // A couple who's already planning doesn't need the marketing pitch — the hero
  // and tool-promo bands below swap for a snapshot of their own data instead.
  protected readonly isCouple = this.auth.isCouple;
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly coupleSvc = inject(CoupleService);
  private readonly checklistSvc = inject(ChecklistService);
  private readonly overviewBudgetSvc = inject(BudgetService);
  private readonly websiteSvc = inject(WebsiteService);
  private readonly guestSvc = inject(GuestService);
  private readonly seatingSvc = inject(SeatingService);
  protected readonly wishlist = inject(WishlistService);
  private overviewLoadStarted = false;

  protected readonly couple = signal<CoupleProfile | null>(null);
  protected readonly greetingNames = computed(() => {
    const c = this.couple();
    if (!c) return '';
    const a = (c.firstName || '').trim();
    const b = (c.partnerFirstName || '').trim();
    if (a && b) return `${a} & ${b}`;
    return a || b || '';
  });
  protected readonly daysToWedding = computed<number | null>(() => {
    const date = this.couple()?.weddingDate;
    if (!date) return null;
    const wedding = new Date(date + 'T00:00:00').getTime();
    if (Number.isNaN(wedding)) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((wedding - today.getTime()) / 86_400_000);
  });

  protected readonly checklistItems = signal<ChecklistItem[]>([]);
  protected readonly checklistDone = computed(
    () => this.checklistItems().filter((i) => i.isDone).length,
  );

  protected readonly overviewBudget = signal<Budget | null>(null);
  protected readonly budgetStarted = computed(() => this.overviewBudget()?.totalBudget != null);
  protected readonly budgetPaid = computed(() =>
    (this.overviewBudget()?.items ?? []).reduce((sum, i) => sum + (i.paid ?? 0), 0),
  );
  protected readonly budgetScale = computed(() => {
    const total = this.overviewBudget()?.totalBudget;
    if (!total) return 0;
    return Math.min(100, Math.round((this.budgetPaid() / total) * 100));
  });

  protected readonly reminders = signal<BudgetReminder[]>([]);
  protected readonly nextReminder = computed(() => this.reminders()[0] ?? null);
  protected readonly nextReminderStatus = computed(() => {
    const r = this.nextReminder();
    return r ? reminderStatus(r.reminderDate) : null;
  });

  protected readonly site = signal<WeddingSiteRecord | null>(null);
  protected readonly siteStatus = computed<'none' | 'draft' | 'published'>(() => {
    const s = this.site();
    if (!s) return 'none';
    return s.isPublished ? 'published' : 'draft';
  });

  // The hero always shows a real photo — their own wedding-site upload once
  // they have one, the same editorial stock shot the rest of the site uses
  // until then. Never an empty placeholder box.
  protected readonly heroPhoto = computed(
    () => this.site()?.photoUrl ?? img('photo-1583939003579-730e3918a45a', 1200),
  );

  protected readonly guests = signal<Guest[]>([]);
  protected readonly guestCount = computed(() => this.guests().length);

  protected readonly seating = signal<SeatingState | null>(null);
  protected readonly seatingStarted = computed(() => (this.seating()?.tables.length ?? 0) > 0);
  protected readonly seatedCount = computed(() => this.seating()?.assignments.length ?? 0);
  protected readonly seatingComplete = computed(
    () => this.guestCount() > 0 && this.seatedCount() >= this.guestCount(),
  );

  // The single most useful next action, in the order a couple actually plans a
  // Georgian wedding: budget first (it shapes every other choice), then who's
  // coming, then the day-to-day checklist, then the two "nice to have, once the
  // basics are set" tools. Each check is on REAL state — nothing here is a guess.
  protected readonly nextStep = computed<{ link: string; key: string } | null>(() => {
    if (!this.budgetStarted()) return { link: '/budget', key: 'home.ov.nextBudget' };
    if (this.guestCount() === 0) return { link: '/guests', key: 'home.ov.nextGuests' };
    if (this.checklistDone() === 0 && this.checklistItems().length > 0) {
      return { link: '/planning', key: 'home.ov.nextChecklist' };
    }
    if (this.siteStatus() === 'none') return { link: '/website', key: 'home.ov.nextWebsite' };
    if (!this.seatingStarted()) return { link: '/seating', key: 'home.ov.nextSeating' };
    return null;
  });

  // What a signed-in couple has already added, by category slug — read straight
  // off their real budget rows. Every category is auto-seeded with a suggested
  // estimate on signup (Georgian-norm split), so an estimate alone doesn't
  // count — only a linked vendor, a typed merchant, or a real cost/payment
  // means the couple actually settled something for that category.
  protected readonly addedByCategory = computed(() => {
    const map = new Map<string, BudgetItem>();
    for (const item of this.overviewBudget()?.items ?? []) {
      if (!item.categorySlug) continue;
      const hasRealProgress =
        item.vendor != null || !!item.merchantName || (item.actualCost ?? 0) > 0 || (item.paid ?? 0) > 0;
      if (hasRealProgress) map.set(item.categorySlug, item);
    }
    return map;
  });

  protected addedLabel(item: BudgetItem): string {
    return item.vendor?.name ?? item.merchantName ?? item.name;
  }

  constructor() {
    // Fetch once, only in the browser, only when the visitor turns out to be a
    // signed-in couple — mirrors the planning page's load latch so an auth state
    // that settles after hydration still populates the overview.
    effect(() => {
      if (!this.isBrowser || !this.isCouple() || this.overviewLoadStarted) return;
      this.overviewLoadStarted = true;
      this.coupleSvc.me().subscribe({ next: (c) => this.couple.set(c), error: () => {} });
      this.checklistSvc.list().subscribe({
        next: (items) => this.checklistItems.set(items),
        error: () => {},
      });
      this.overviewBudgetSvc.get().subscribe({ next: (b) => this.overviewBudget.set(b), error: () => {} });
      this.overviewBudgetSvc.reminders().subscribe({ next: (r) => this.reminders.set(r), error: () => {} });
      this.websiteSvc.get().subscribe({ next: (s) => this.site.set(s), error: () => {} });
      this.guestSvc.list().subscribe({ next: (g) => this.guests.set(g), error: () => {} });
      this.seatingSvc.load().subscribe({ next: (s) => this.seating.set(s), error: () => {} });
    });
  }

  protected outstanding(r: BudgetReminder): number {
    return Math.max(0, (r.actualCost ?? r.estimate ?? 0) - (r.paid ?? 0));
  }

  protected formatDate(date: string): string {
    const locale = this.lang.current() === 'en' ? 'en-US' : 'ka-GE';
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(
      new Date(date + 'T00:00:00'),
    );
  }

  protected formatFullDate(date: string): string {
    const locale = this.lang.current() === 'en' ? 'en-US' : 'ka-GE';
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(
      new Date(date + 'T00:00:00'),
    );
  }

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

  protected formatGel(amount: number): string {
    const locale = this.lang.current() === 'en' ? 'en-US' : 'ka-GE';
    return new Intl.NumberFormat(locale).format(amount) + ' ₾';
  }
}
