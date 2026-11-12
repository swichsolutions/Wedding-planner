import { DOCUMENT, isPlatformServer } from '@angular/common';
import { Component, DestroyRef, PLATFORM_ID, afterNextRender, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../core/auth.service';
import { Reveal } from '../../core/reveal.directive';
import { ScrollStage } from '../../core/scroll-stage.directive';
import { ColorBand } from '../../core/color-band.directive';
import { OrganizerHero } from './organizer-hero/organizer-hero';
import { TrustFaq } from './trust-faq/trust-faq';
import { FinalCall } from './final-call/final-call';
import { DayPreview } from '../../components/day-preview/day-preview';
import { CarouselArrow } from '../../components/carousel-arrow/carousel-arrow';
import { img } from '../../core/catalog';
import { CategoryStat, VendorService } from '../../core/vendor.service';

/**
 * Landing page, in seven sections (the order since the review of 2026-11-12): hero → three
 * steps → categories → organizer → example day schedules → FAQ → final call. The first two
 * share one stage: on the first scroll the hero photo fades into the first step's photo and
 * the box in its middle becomes that step's card (core/scroll-stage.directive.ts,
 * home.scss). Each section answers the question
 * a couple naturally asks next. All copy lives in i18n under `home.*` (the schedules in
 * core/day-schedules.ts); this file only holds structure.
 */

/** One row of the category index: a group of catalog slugs shown as a single entry. */
interface CategoryGroup {
  key: string; // i18n key under home.find.cat
  slugs: string[]; // catalog slugs folded into this row (their vendor counts are summed)
  query: Record<string, string>; // the catalog view this row opens: a group, or one category
  img: string; // the card visual: a full-card render (object on the peach backdrop) or, with `print`, a scene
  print?: boolean; // show the visual as a rounded print instead of a cut-out
}

/** A row with its live inventory folded in (approved vendors summed across the group's slugs). */
interface CategoryRow extends CategoryGroup {
  count: number;
  thumb: string; // small square crop of `img` for the category tile
  srcset: string; // the render at 720 and 1086 px wide (sharp on 2x/3x screens)
}

@Component({
  selector: 'app-home',
  imports: [RouterLink, TranslatePipe, Reveal, ScrollStage, ColorBand, OrganizerHero, TrustFaq, FinalCall, DayPreview, CarouselArrow],
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

  /** The last section's button: a visitor is asked to open an account; signed-in users get
   * the same button as in the hero. */
  protected readonly finalCta = computed<{ link: string; key: string }>(() => {
    const cta = this.heroCta();
    return cta.link === '/signup' ? { link: cta.link, key: 'home.trust.finalCta' } : cta;
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    const translate = inject(TranslateService);
    inject(Title).setTitle(translate.instant('home.metaTitle'));
    inject(Meta).updateTag({ name: 'description', content: translate.instant('home.metaDescription') });
    // The hero render and the brand faces are used on this page only, so they are
    // preloaded from here (in the server-rendered head of '/'), not from index.html for
    // every route.
    if (isPlatformServer(inject(PLATFORM_ID))) this.preloadAssets(inject(DOCUMENT));
    afterNextRender(() => {
      this.setUpOrbit(destroyRef);
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) this.reelPlays.set(false);
      destroyRef.onDestroy(() => this.stopRotation());
    });
  }

  private rotationId: number | undefined;

  private startRotation(): void {
    this.stopRotation();
    this.rotating.set(true);
    this.rotationId = window.setInterval(() => {
      // not in a background tab (don't burn cycles or skip slides), and not while the visitor
      // is using the stage: the step would change under their keyboard focus or their pointer
      if (document.hidden || this.introPaused()) return;
      this.slide.update((i) => (i + 1) % this.startSlides.length);
    }, 10400);
  }

  private stopRotation(): void {
    if (this.rotationId !== undefined) window.clearInterval(this.rotationId);
    this.rotationId = undefined;
    this.rotating.set(false);
  }

  /** Jump to a step from its bottom label. Restarts the timer so the slide the
   * visitor just picked gets a full turn before auto-rotation moves on. */
  protected goToSlide(i: number): void {
    this.slide.set(i);
    if (this.rotating()) this.startRotation();
  }

  /** 02 — the three planning steps, each a full-bleed photo + the step card (see-through on
   * every step). The slides rotate on their own once the stage has run (browser only, not
   * under reduced motion); the bottom labels switch directly. */
  protected readonly startSlides: { key: string; img: string; srcset?: string; pos?: string; to: 'find' | 'organize' | 'day' }[] = [
    // couple in a convertible under cypresses, b&w, portrait (Beka's photo 156.jpg);
    // the couple sits low in the frame, so wide screens anchor the crop there. The 1200px
    // copy is what phones load (the 2400px original is 855 kB).
    {
      key: 's1',
      img: '/media/plan-define-2.webp',
      srcset: '/media/plan-define-2-1200.webp 1200w, /media/plan-define-2.webp 2400w',
      pos: 'center 78%',
      to: 'organize',
    },
    { key: 's2', img: img('photo-1583939003579-730e3918a45a', 2400), to: 'find' },
    // Beka's photo (OneDrive Desktop/9411badc...jpg), portrait, 1067 px wide source
    { key: 's3', img: '/media/plan-details-3.webp', pos: 'center 55%', to: 'day' },
  ];
  protected readonly slide = signal(0);
  /** True from the first scroll on: the photos of steps 2 and 3 join the page (see the template). */
  protected readonly slidesArmed = signal(false);
  /** True while the slides turn on their own (drives the ring's fill and the live region). */
  protected readonly rotating = signal(false);
  /** The pointer rests on the step's box / keyboard focus is somewhere in the stage. Either
   * holds the rotation (and the ring's fill): a moving step must be pausable, and its link
   * must not be swapped out while someone is about to follow it. */
  protected readonly cardHover = signal(false);
  protected readonly introFocus = signal(false);
  protected readonly introPaused = computed(() => this.cardHover() || this.introFocus());

  /** The stage ran (the first scroll) or went back to rest (the top of the page). Rest is
   * the hero with the first step in its box, so the rotation stops and rewinds there. */
  protected onStage(ran: boolean): void {
    if (ran) {
      this.slidesArmed.set(true);
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) this.startRotation();
    } else {
      this.stopRotation();
      this.slide.set(0);
    }
  }

  /** The hero's scroll arrow: on to the second section, and keyboard focus with it (left
   * on the arrow, focus would sit on a control that has just faded out). Never the plain
   * "#start" anchor: with <base href="/"> it resolves to "/#start", which reloads the page
   * when the address carries a query. On the pinned stage the section is already on
   * screen, so it is focus that brings it on (ScrollStage scrolls to the state that shows
   * a focused control); stacked, the page scrolls down to it. */
  protected runStage(event: Event): void {
    event.preventDefault();
    const start = document.getElementById('start');
    if (!start) return;
    const staged = !!(event.currentTarget as HTMLElement).closest('.intro.is-staged');
    // (no `behavior`: the page's own CSS scrolls smoothly, and not under reduced motion)
    if (!staged) start.scrollIntoView({ block: 'start' });
    start.focus({ preventScroll: true });
  }

  /** 03 — the categories: the 14 catalog slugs folded into nine cards (the carousel;
   * the older editorial index is commented out in the template). Inventory comes from
   * the API; a card with no approved vendors shows no count instead of a zero. */
  private readonly categoryGroups: CategoryGroup[] = [
    // Revolut-style cards: Beka's renders, one scene or object on a shared peach backdrop
    // with a floor reflection; each has a `-1086` twin for dense screens
    // (public/media/README.md)
    // Rows open the catalog's group (guide §4); rings and transport open their one category.
    { key: 'venues', slugs: ['darbazi', 'keiteringi'], query: { group: 'venues' }, img: '/media/cat/venues.webp' },
    { key: 'photo', slugs: ['fotografi', 'videografi'], query: { group: 'photo' }, img: '/media/cat/photo.webp' },
    { key: 'decor', slugs: ['dekori', 'floristi', 'inventari'], query: { group: 'decor' }, img: '/media/cat/decor.webp' },
    { key: 'music', slugs: ['musika', 'tamada', 'tsamqvani', 'gasartobi'], query: { group: 'music' }, img: '/media/cat/music.webp' },
    { key: 'cake', slugs: ['torti', 'tkbileuli'], query: { group: 'cake' }, img: '/media/cat/cake.webp' },
    { key: 'attire', slugs: ['kaba', 'kostiumi', 'pekhsatsmeli'], query: { group: 'attire' }, img: '/media/cat/attire.webp' },
    { key: 'rings', slugs: ['bechdebi'], query: { category: 'bechdebi' }, img: '/media/cat/rings.webp' },
    { key: 'beauty', slugs: ['makiaji', 'tmis-stili', 'manikiuri', 'saloni', 'movla'], query: { group: 'beauty' }, img: '/media/cat/beauty.webp' },
    { key: 'transport', slugs: ['transporti'], query: { category: 'transporti' }, img: '/media/cat/transport.webp' },
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
    // (the brand faces are Noto Sans Georgian since 2026-11-03, loaded by index.html's font link)
  }

  /** Where a stage card or a step pill leads (Beka, 2026-11-03): the catalog for "find the
   * people", the day schedules for "the day", and the organizer for everything else — which
   * means sign-up (or sign-in) first for a visitor, and their own page for a signed-in user. */
  protected stepLink(key: 'find' | 'organize' | 'day'): string {
    if (key === 'find') return '/vendors';
    if (key === 'day') return '/schedules';
    return this.heroCta().link;
  }

  /** One step forward or back through the planning slides (the arrow buttons). */
  protected stepSlide(dir: 1 | -1): void {
    const n = this.startSlides.length;
    this.goToSlide((this.slide() + dir + n) % n);
  }

  /** Which row the stage photo shows; follows hover/focus, keeps the last one on leave.
   * (Used by the editorial index, currently commented out in the template.) */
  protected readonly activeRow = signal(0);

  /** False under reduced motion (kept for any film we add later). */
  protected readonly reelPlays = signal(true);

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
}
