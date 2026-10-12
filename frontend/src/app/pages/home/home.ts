import { DOCUMENT, isPlatformServer } from '@angular/common';
import { Component, DestroyRef, ElementRef, PLATFORM_ID, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../core/auth.service';
import { Reveal } from '../../core/reveal.directive';
import { ScrollStage } from '../../core/scroll-stage.directive';
import { ColorBand } from '../../core/color-band.directive';
import { OrganizerHero } from './organizer-hero/organizer-hero';
import { TrustFaq } from './trust-faq/trust-faq';
import { FinalCall } from './final-call/final-call';
import { img } from '../../core/catalog';
import { CategoryStat, VendorService } from '../../core/vendor.service';

/**
 * Landing page — "Program on Paper". Six chapters from the sitemap, each answering
 * the question a couple naturally asks next, with ONE example wedding (Nino & Giorgi)
 * threaded through: first plan → chosen venue → organizer → day schedule.
 * All copy lives in i18n under `home.*`; this file only holds structure.
 */

/** One row of the category index: a group of catalog slugs shown as a single entry. */
interface CategoryGroup {
  key: string; // i18n key under home.find.cat
  slugs: string[]; // catalog slugs folded into this row; slugs[0] is the browse link target
  img: string; // the card visual: a full-card render (object on the peach backdrop) or, with `print`, a scene
  print?: boolean; // show the visual as a rounded print instead of a cut-out
}

/** A row with its live inventory folded in (approved vendors summed across the group's slugs). */
interface CategoryRow extends CategoryGroup {
  count: number;
  thumb: string; // small square crop of `img` for the category tile
  srcset: string; // the render at 720 and 1086 px wide (sharp on 2x/3x screens)
}

interface ScheduleItem {
  time: string;
  key: string; // i18n key under home.day.item
  optional?: boolean;
  edited?: string; // the one row shown "being edited" → new time
}

@Component({
  selector: 'app-home',
  imports: [RouterLink, TranslatePipe, Reveal, ScrollStage, ColorBand, OrganizerHero, TrustFaq, FinalCall],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  // brand theme (Mint & Peach + GF Aisi) for the whole page, see styles/_brand.scss
  host: { class: 'theme-brand' },
})
export class Home {
  private readonly auth = inject(AuthService);

  /** Hero CTA follows the visitor: guests are asked to start; signed-in users go to
   * their own surface instead of a registration page they can't use. */
  protected readonly heroCta = computed<{ link: string; key: string }>(() => {
    if (this.auth.isCouple()) return { link: '/planning', key: 'home.hero.ctaCouple' };
    if (this.auth.isVendor()) return { link: '/dashboard', key: 'home.hero.ctaVendor' };
    if (this.auth.isAdmin()) return { link: '/admin', key: 'home.hero.ctaAdmin' };
    return { link: '/signup', key: 'home.hero.cta' };
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    // The hero render and the brand faces are used on this page only, so they are
    // preloaded from here (in the server-rendered head of '/'), not from index.html for
    // every route.
    if (isPlatformServer(inject(PLATFORM_ID))) this.preloadAssets(inject(DOCUMENT));
    afterNextRender(() => {
      this.setUpStrip(destroyRef);
      this.setUpOrbit(destroyRef);
      this.setUpDay(destroyRef);
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.reelPlays.set(false);
        return;
      }
      this.autoRotate = true;
      this.startRotation();
      destroyRef.onDestroy(() => this.stopRotation());
    });
  }

  private autoRotate = false;
  private rotationId: number | undefined;

  private startRotation(): void {
    this.stopRotation();
    this.rotationId = window.setInterval(() => {
      if (document.hidden) return; // don't burn cycles (or skip slides) in a background tab
      this.slide.update((i) => (i + 1) % this.startSlides.length);
    }, 10400);
  }

  private stopRotation(): void {
    if (this.rotationId !== undefined) window.clearInterval(this.rotationId);
    this.rotationId = undefined;
  }

  /** Jump to a step from its bottom label. Restarts the timer so the slide the
   * visitor just picked gets a full turn before auto-rotation moves on. */
  protected goToSlide(i: number): void {
    this.slide.set(i);
    if (this.autoRotate) this.startRotation();
  }

  /** Left stage card (venues & services): a set reception table outdoors. */
  /** left hero card: a bright hall with an arched ceiling, hanging florals and set
   * tables (local photo, Pexels 14716282) */
  protected readonly venueImg = '/media/venue.webp';
  /** right hero card: phone calendar with the date circled, rings and white flowers
   * (local photo, Pexels 25002851) */
  protected readonly organizerImg = '/media/organizer.webp';

  /** Phones: which card of the strip is centred (0 planning · 1 venues · 2 organizer).
   * Drives the card scale/dim and the dots; starts on the venues card. */
  protected readonly stripActive = signal(1);
  private readonly stripTrack = viewChild<ElementRef<HTMLElement>>('stripTrack');
  private stripRaf = 0;

  /** Once per frame while the strip scrolls: the card nearest its centre line is active. */
  protected onStripScroll(track: HTMLElement): void {
    if (this.stripRaf) return;
    this.stripRaf = requestAnimationFrame(() => {
      this.stripRaf = 0;
      const cards = Array.from(track.children) as HTMLElement[];
      if (cards.length < 2) return;
      const centre = (c: HTMLElement) => c.offsetLeft + c.offsetWidth / 2;
      const stride = centre(cards[1]) - centre(cards[0]);
      if (!stride) return; // strip not laid out (md+ hides it)
      const t = (track.scrollLeft + track.clientWidth / 2 - centre(cards[0])) / stride;
      this.stripActive.set(Math.round(Math.min(cards.length - 1, Math.max(0, t))));
    });
  }

  /** Centre the strip on a card without animation (the strip only lays out on phones,
   * so this is a no-op on wider screens where it has no width). */
  private centreStrip(index = this.stripActive()): void {
    const track = this.stripTrack()?.nativeElement;
    if (!track || !track.offsetWidth) return;
    const card = track.children[index] as HTMLElement | undefined;
    if (!card) return;
    const left = card.offsetLeft + card.offsetWidth / 2 - track.clientWidth / 2;
    track.scrollTo({ left, behavior: 'instant' as ScrollBehavior });
  }

  /** Browser only: centre once the layout has settled, and keep the active card
   * centred when the viewport changes (rotation, or a desktop window shrinking). */
  private setUpStrip(destroyRef: DestroyRef): void {
    this.centreStrip();
    requestAnimationFrame(() => this.centreStrip());
    window.addEventListener('load', () => this.centreStrip(), { once: true });
    let timer = 0;
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => this.centreStrip(), 120);
    };
    window.addEventListener('resize', onResize);
    destroyRef.onDestroy(() => {
      window.removeEventListener('resize', onResize);
      window.clearTimeout(timer);
    });
  }

  /** 02 — the three planning steps, each a full-bleed photo + the step card.
   * Rotates on its own (browser only, not under reduced motion); the bottom labels
   * also switch slides directly. */
  protected readonly startSlides: { key: string; img: string; pos?: string }[] = [
    // couple in a convertible under cypresses, b&w, portrait (Beka's photo 156.jpg);
    // the couple sits low in the frame, so wide screens anchor the crop there
    { key: 's1', img: '/media/plan-define-2.webp', pos: 'center 78%' },
    { key: 's2', img: img('photo-1583939003579-730e3918a45a', 2400) },
    // Beka's photo (OneDrive Desktop/9411badc...jpg), portrait, 1067 px wide source
    { key: 's3', img: '/media/plan-details-3.webp', pos: 'center 55%' },
  ];
  protected readonly slide = signal(0);

  /** 03 — the categories: the 14 catalog slugs folded into nine cards (the carousel;
   * the older editorial index is commented out in the template). Inventory comes from
   * the API; a card with no approved vendors shows no count instead of a zero. */
  private readonly categoryGroups: CategoryGroup[] = [
    // Revolut-style cards: Beka's renders, one scene or object on a shared peach backdrop
    // with a floor reflection; each has a `-1086` twin for dense screens
    // (public/media/README.md)
    { key: 'venues', slugs: ['darbazi'], img: '/media/cat/venues.webp' },
    { key: 'photo', slugs: ['fotografi', 'videografi'], img: '/media/cat/photo.webp' },
    { key: 'decor', slugs: ['dekori', 'floristi'], img: '/media/cat/decor.webp' },
    { key: 'music', slugs: ['musika'], img: '/media/cat/music.webp' },
    { key: 'cake', slugs: ['torti'], img: '/media/cat/cake.webp' },
    { key: 'attire', slugs: ['kaba', 'kostiumi'], img: '/media/cat/attire.webp' },
    { key: 'rings', slugs: ['bechdebi'], img: '/media/cat/rings.webp' },
    { key: 'beauty', slugs: ['makiaji', 'tmis-stili', 'manikiuri'], img: '/media/cat/beauty.webp' },
    { key: 'transport', slugs: ['transporti'], img: '/media/cat/transport.webp' },
  ];

  private readonly vendors = inject(VendorService);
  private readonly categoryStats = toSignal(this.vendors.categoryStats(), { initialValue: [] as CategoryStat[] });

  protected readonly categoryRows = computed<CategoryRow[]>(() => {
    const bySlug = new Map(this.categoryStats().map((s) => [s.categorySlug, s.count]));
    return this.categoryGroups.map((g) => ({
      ...g,
      count: g.slugs.reduce((n, s) => n + (bySlug.get(s) ?? 0), 0),
      thumb: g.img.replace(/w=\d+/, 'w=128&h=128'),
      srcset: `${g.img} 720w, ${g.img.replace(/\.webp$/, '-1086.webp')} 1086w`,
    }));
  });

  private preloadAssets(doc: Document): void {
    // attributes, not IDL properties: the server DOM drops `link.as`
    const add = (attrs: Record<string, string>) => {
      const link = doc.createElement('link');
      link.setAttribute('rel', 'preload');
      for (const [k, v] of Object.entries(attrs)) link.setAttribute(k, v);
      doc.head.appendChild(link);
    };
    // the hero: the orientation-specific render (same files as the <picture>)
    add({ as: 'image', type: 'image/webp', href: '/media/hero-wide.webp', media: '(orientation: landscape)' });
    add({ as: 'image', type: 'image/webp', href: '/media/hero-tall.webp', media: '(orientation: portrait)' });
    for (const file of ['GFAisi2025Mt-Medium', 'GFAisi2025Nus-Medium']) {
      add({ as: 'font', type: 'font/woff2', crossorigin: 'anonymous', href: `/fonts/${file}.woff2` });
    }
  }

  /** Which row the stage photo shows; follows hover/focus, keeps the last one on leave.
   * (Used by the editorial index, currently commented out in the template.) */
  protected readonly activeRow = signal(0);

  /** False under reduced motion (kept for any film we add later). */
  protected readonly reelPlays = signal(true);

  /** The day timeline: which moment the marker is on. Walks forward every 2s and
   * wraps (browser only, not under reduced motion — then it rests on the third stop). */
  protected readonly dayStep = signal(2);
  private dayTimer = 0;

  private setUpDay(destroyRef: DestroyRef): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.dayStep.set(0);
    this.dayTimer = window.setInterval(() => {
      if (document.hidden) return;
      this.dayStep.update((s) => (s + 1) % this.schedule.length);
    }, 2000);
    destroyRef.onDestroy(() => window.clearInterval(this.dayTimer));
  }

  // ---- the category carousel around the ring ----
  /** Index of the centred card. */
  protected readonly orbitActive = signal(0);
  protected readonly orbitHover = signal(false);
  private orbitTimer = 0;
  private orbitDrag: { x: number; id: number; moved: boolean } | null = null;

  /** Where card `i` sits relative to the centred one: slots -2 … 2 are on stage,
   * anything further is parked out of view (null). */
  protected orbitSlot(i: number): number | null {
    const n = this.categoryRows().length;
    if (!n) return null;
    let k = (i - this.orbitActive()) % n;
    if (k > n / 2) k -= n;
    if (k < -n / 2) k += n;
    return k >= -2 && k <= 2 ? k : null;
  }

  protected orbitGo(i: number): void {
    const n = this.categoryRows().length;
    if (!n) return;
    this.orbitActive.set(((i % n) + n) % n);
    this.restartOrbit();
  }

  protected orbitStep(dir: 1 | -1): void {
    this.orbitGo(this.orbitActive() + dir);
  }

  // drag / swipe: a horizontal move of 40px steps the carousel; a plain tap still
  // follows the card's link
  protected onOrbitDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    this.orbitDrag = { x: e.clientX, id: e.pointerId, moved: false };
    this.stopOrbit();
  }

  protected onOrbitMove(e: PointerEvent): void {
    const d = this.orbitDrag;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) < 40) return;
    d.moved = true;
    d.x = e.clientX;
    this.orbitStep(dx < 0 ? 1 : -1);
  }

  protected onOrbitUp(e: PointerEvent): void {
    if (this.orbitDrag && e.pointerId === this.orbitDrag.id) {
      const moved = this.orbitDrag.moved;
      this.orbitDrag = null;
      if (moved) this.orbitSuppressClick = true;
      this.restartOrbit();
    }
  }

  private orbitSuppressClick = false;

  protected onOrbitClick(e: MouseEvent): void {
    if (this.orbitSuppressClick) {
      e.preventDefault();
      this.orbitSuppressClick = false;
    }
  }

  private startOrbit(): void {
    this.stopOrbit();
    this.orbitTimer = window.setInterval(() => {
      if (document.hidden || this.orbitHover() || this.orbitDrag) return;
      this.orbitActive.update((a) => (a + 1) % Math.max(1, this.categoryRows().length));
    }, 3800);
  }

  private stopOrbit(): void {
    if (this.orbitTimer) window.clearInterval(this.orbitTimer);
    this.orbitTimer = 0;
  }

  private restartOrbit(): void {
    if (this.orbitAuto) this.startOrbit();
  }

  private orbitAuto = false;

  /** Browser only: start auto-advance (not under reduced motion). */
  private setUpOrbit(destroyRef: DestroyRef): void {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.orbitAuto = true;
      this.startOrbit();
    }
    destroyRef.onDestroy(() => this.stopOrbit());
  }

  protected readonly tasks = [
    { key: '1', done: true },
    { key: '2', done: true },
    { key: '3', done: false },
    { key: '4', done: false },
  ];

  protected readonly budgetRows = ['1', '2', '3', '4'];

  protected readonly savedVendors = [
    { key: '1', chosen: true },
    { key: '2', chosen: true },
    { key: '3', chosen: false },
  ];

  protected readonly schedule: ScheduleItem[] = [
    { time: '16:00', key: '1' },
    { time: '17:00', key: '2', optional: true },
    { time: '18:00', key: '3' },
    { time: '19:30', key: '4', edited: '20:00' },
    { time: '21:00', key: '5' },
    { time: '23:30', key: '6' },
  ];
}
