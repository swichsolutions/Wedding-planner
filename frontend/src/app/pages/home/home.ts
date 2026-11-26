import { DOCUMENT, isPlatformServer } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, ElementRef, NgZone, PLATFORM_ID, afterNextRender, computed, inject, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
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
import { groupPath, img } from '../../core/catalog';

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
  slugs: string[]; // catalog slugs folded into this row
  link: string; // the catalog page this row opens: a group's, or one category's
  img: string; // the card visual: a full-card render (object on the peach backdrop) or, with `print`, a scene
  print?: boolean; // show the visual as a rounded print instead of a cut-out
}

/** A row as the template draws it. */
interface CategoryRow extends CategoryGroup {
  srcset: string; // the render at 720 and 1086 px wide (the template's `sizes` picks: 720 on phones)
}

@Component({
  selector: 'app-home',
  imports: [RouterLink, TranslatePipe, Reveal, ScrollStage, ColorBand, OrganizerHero, TrustFaq, FinalCall, DayPreview, CarouselArrow],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  // brand theme (Mint & Peach + GF Aisi) for the whole page, see styles/_brand.scss
  host: { class: 'theme-brand', '[class.home--lean]': 'lean' },
})
export class Home {
  private readonly auth = inject(AuthService);

  /**
   * True on the server and while the browser is still on the page it loaded: the sections
   * below the first screen are then left out of layout until they come near it (home.scss,
   * .home--lean), which is what keeps a phone responsive while the page loads. False when the
   * home page is reached from another page of the site: nothing is loading then, and with every
   * section measured the back button returns to the exact spot.
   */
  protected readonly lean = !inject(Router).navigated;

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
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterNextRender(() => {
      this.setUpOrbit(host, destroyRef);
      this.setUpStepsSwipe(host, destroyRef);
      destroyRef.onDestroy(() => this.stopRotation());
    });
  }

  private readonly zone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);

  private rotationId: number | undefined;

  private startRotation(): void {
    this.stopRotation();
    this.rotating.set(true);
    this.rotationId = window.setInterval(() => {
      // not in a background tab (don't burn cycles or skip slides), and not while the visitor
      // is using the stage: the step would change under their keyboard focus or their pointer
      if (document.hidden || this.introPaused() || this.stepsDrag) return;
      this.slideDir.set('next');
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
    const n = this.startSlides.length;
    // the short way round: one step forward is "next", one step back (n - 1 forward) "prev"
    this.slideDir.set((i - this.slide() + n) % n === n - 1 ? 'prev' : 'next');
    this.slide.set(i);
    if (this.rotating()) this.startRotation();
  }

  /** Which way the steps last turned (see parkedSlot). */
  private readonly slideDir = signal<'next' | 'prev'>('next');

  /** 02 — the three planning steps, each a full-bleed photo + the step card (see-through on
   * every step). The slides rotate on their own once the stage has run (browser only, not
   * under reduced motion); the bottom labels switch directly. */
  protected readonly startSlides: { key: string; img: string; srcset?: string; pos?: string; to: 'find' | 'organize' | 'day' }[] = [
    // couple in a convertible under cypresses, b&w, portrait (Beka's photo 156.jpg);
    // the couple sits low in the frame, so wide screens anchor the crop there. The 1200px
    // copy is what phones load and the 1600px one most laptops (269 kB; the 2400px original
    // is 855 kB, and on the pinned stage this photo loads with the page, under the hero's).
    {
      key: 's1',
      img: '/media/plan-define-2.webp',
      srcset: '/media/plan-define-2-1200.webp 1200w, /media/plan-define-2-1600.webp 1600w, /media/plan-define-2.webp 2400w',
      pos: 'center 78%',
      to: 'organize',
    },
    { key: 's2', img: img('photo-1583939003579-730e3918a45a', 2400), to: 'find' },
    // Beka's photo (OneDrive Desktop/9411badc...jpg), portrait, 1067 px wide source
    { key: 's3', img: '/media/plan-details-3.webp', pos: 'center 55%', to: 'day' },
  ];
  protected readonly slide = signal(0);
  /** True from the first scroll on: the photos of steps 2 and 3 join the page, and on the stacked
   * layout the first one loads (see the template). */
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

  /** 03 — the categories: the catalog's slugs folded into nine cards (the carousel; the older
   * editorial index went on 2026-11-13, it is in git history). A card is its name and its
   * picture; the count of vendors it used to show went on 2026-11-18, and the page no longer
   * asks the API for it. */
  private readonly categoryGroups: CategoryGroup[] = [
    // Revolut-style cards: Beka's renders, one scene or object on a shared peach backdrop
    // with a floor reflection; each has a `-1086` twin for dense screens
    // (public/media/README.md)
    // One card per catalog group, in the header menu's order and under its names (guide §4).
    // Until 2026-11-26 two cards were single categories (rings, transport): the accessories and
    // "other services" groups were only in the menu, and their other categories had no card.
    { key: 'venues', slugs: ['darbazi', 'keiteringi'], link: groupPath('venues'), img: '/media/cat/venues.webp' },
    { key: 'photo', slugs: ['fotografi', 'videografi'], link: groupPath('photo'), img: '/media/cat/photo.webp' },
    { key: 'decor', slugs: ['dekori', 'floristi', 'inventari'], link: groupPath('decor'), img: '/media/cat/decor.webp' },
    { key: 'music', slugs: ['musika', 'tamada', 'tsamqvani', 'gasartobi'], link: groupPath('music'), img: '/media/cat/music.webp' },
    { key: 'cake', slugs: ['torti', 'tkbileuli'], link: groupPath('cake'), img: '/media/cat/cake.webp' },
    { key: 'attire', slugs: ['kaba', 'kostiumi', 'pekhsatsmeli'], link: groupPath('attire'), img: '/media/cat/attire.webp' },
    { key: 'accessories', slugs: ['aksesuarebi', 'bechdebi'], link: groupPath('accessories'), img: '/media/cat/rings.webp' },
    { key: 'beauty', slugs: ['makiaji', 'tmis-stili', 'manikiuri', 'saloni', 'movla'], link: groupPath('beauty'), img: '/media/cat/beauty.webp' },
    { key: 'other', slugs: ['transporti', 'bechduri-mosatsvevebi', 'koordinatori'], link: groupPath('other'), img: '/media/cat/transport.webp' },
  ];

  protected readonly categoryRows = computed<CategoryRow[]>(() =>
    this.categoryGroups.map((g) => ({
      ...g,
      srcset: `${g.img} 720w, ${g.img.replace(/\.webp$/, '-1086.webp')} 1086w`,
    })),
  );

  private preloadAssets(doc: Document): void {
    // attributes, not IDL properties: the server DOM drops `link.as`
    const add = (attrs: Record<string, string>) => {
      const link = doc.createElement('link');
      link.setAttribute('rel', 'preload');
      for (const [k, v] of Object.entries(attrs)) link.setAttribute(k, v);
      doc.head.appendChild(link);
    };
    // the hero: the orientation-specific render (same files and queries as the <picture>;
    // phones take the 828px copy of the tall one)
    add({ as: 'image', type: 'image/webp', href: '/media/hero-wide.webp', media: '(orientation: landscape)' });
    add({ as: 'image', type: 'image/webp', href: '/media/hero-tall-828.webp', media: '(orientation: portrait) and (max-width: 600px)' });
    add({ as: 'image', type: 'image/webp', href: '/media/hero-tall.webp', media: '(orientation: portrait) and (min-width: 600.01px)' });
    // The text face (FiraGO since 2026-11-18): the first screen's words wait for its regular
    // and medium weights to be drawn in the site's face.
    add({ as: 'font', type: 'font/woff2', href: '/fonts/FiraGO-Regular.woff2', crossorigin: '' });
    add({ as: 'font', type: 'font/woff2', href: '/fonts/FiraGO-Medium.woff2', crossorigin: '' });
    // the heading face (the hero's headline is the first thing drawn in it)
    add({ as: 'font', type: 'font/woff2', href: '/fonts/GeoBauhausNusx-Unicode.woff2', crossorigin: '' });
  }

  /** Where a stage card or a step pill leads (Beka, 2026-11-03): the catalog for "find the
   * people", the day schedules for "the day", and the organizer for everything else — which
   * means sign-up (or sign-in) first for a visitor, and their own page for a signed-in user. */
  protected stepLink(key: 'find' | 'organize' | 'day'): string {
    if (key === 'find') return '/vendors';
    if (key === 'day') return '/ganrigebi';
    return this.heroCta().link;
  }

  /** One step forward or back through the planning slides (the arrow buttons, a swipe). */
  protected stepSlide(dir: 1 | -1): void {
    const n = this.startSlides.length;
    this.goToSlide((this.slide() + dir + n) % n);
  }

  /** Where step `i`'s card sits relative to the one showing: 0 is showing, 1 is the next,
   * -1 the one before (the steps go round). */
  protected stepSlot(i: number): number {
    const n = this.startSlides.length;
    const k = (i - this.slide() + n) % n;
    return k > n / 2 ? k - n : k;
  }

  /** The slot of the card that had to cross from one end of the row to the other in the last
   * change (going forward, the one that was before is now after): it takes its new place
   * without sliding across the screen. */
  protected readonly parkedSlot = computed(() => (this.slideDir() === 'next' ? 1 : -1));

  // ---- swiping the steps on phones (2026-11-19) ----
  // Phones and tablets only (Beka): a finger, on the stacked layout, where the three cards
  // stand in a row. The pinned desktop stage and the mouse are left as they were.
  //
  // The row follows the finger exactly; the photo of the step it is heading for shows
  // through in step with the drag. Let go past a fifth of the way, or with a flick, and the
  // row glides on to the next card at about the speed it was moving; let go sooner and it
  // glides back. Up-and-down moves stay the page's own scrolling (touch-action: pan-y).
  //
  // Smoothness: the listeners are added outside Angular (a template listener would run
  // change detection on every move of the finger), the drag is drawn once per frame, and it
  // writes each card's own `translate` (drawn by the compositor) instead of a variable on
  // the stage, which would restyle everything inside it. Angular hears of it only when the
  // step really changes.
  private stepsDrag = false;
  private stepsSuppressClick = false;

  private setUpStepsSwipe(host: HTMLElement, destroyRef: DestroyRef): void {
    const stage = host.querySelector<HTMLElement>('.intro__stage');
    const intro = host.querySelector<HTMLElement>('.intro');
    const slides = stage?.querySelector<HTMLElement>('.intro__slides');
    const box = stage?.querySelector<HTMLElement>('.start__card');
    if (!stage || !intro || !slides || !box) return;
    const GAP = 12; // px between the cards: --card-gap in home.scss
    const n = this.startSlides.length;

    interface Drag {
      id: number;
      x: number;
      y: number;
      locked: boolean;
      dx: number;
      span: number; // one card's travel: its width plus the gap
      cards: { el: HTMLElement; k: number }[];
      photos: { el: HTMLElement; i: number }[];
      trail: { dx: number; t: number }[]; // the last moves, for the speed at release
    }
    let drag: Drag | null = null;
    let frame = 0;
    let after = 0;

    const paint = () => {
      frame = 0;
      const d = drag;
      if (!d?.locked) return;
      for (const c of d.cards) c.el.style.translate = `calc(${c.k} * (100% + ${GAP}px) + ${d.dx.toFixed(1)}px) 0px`;
      // the photo of the step the row is heading for shows through, over the others
      const target = (this.slide() + (d.dx < 0 ? 1 : -1) + n) % n;
      const share = Math.min(1, Math.abs(d.dx) / d.span);
      for (const p of d.photos) {
        p.el.style.opacity = p.i === target ? share.toFixed(3) : '';
        p.el.style.zIndex = p.i === target ? '1' : '';
      }
    };

    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || drag) return;
      if (intro.classList.contains('is-staged')) return; // the phone layout only
      // only over the steps: on this layout the same stage also holds the hero
      const area = slides.getBoundingClientRect();
      if (e.clientY < area.top || e.clientY > area.bottom) return;
      drag = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        locked: false,
        dx: 0,
        span: (box.offsetWidth || 280) + GAP,
        cards: Array.from(stage.querySelectorAll<HTMLElement>('.start__card-inner'), (el) => ({ el, k: Number(el.dataset['k']) })),
        photos: Array.from(stage.querySelectorAll<HTMLElement>('.start__bg'), (el) => ({ el, i: Number(el.dataset['i']) })),
        trail: [{ dx: 0, t: e.timeStamp }],
      };
    };

    const move = (e: PointerEvent) => {
      const d = drag;
      if (!d || e.pointerId !== d.id) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.locked) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        // a move that is more up-and-down than sideways is a scroll, not a swipe
        if (Math.abs(dx) < Math.abs(dy) * 1.2) {
          drag = null;
          return;
        }
        d.locked = true;
        this.stepsDrag = true;
        this.stepsHinted = true;
        window.clearTimeout(after);
        stage.classList.remove('is-gliding', 'is-hinting');
        for (const p of d.photos) p.el.style.zIndex = '';
        stage.classList.add('is-swiping');
        stage.setPointerCapture?.(d.id);
      }
      // a card's width at most: there is only one neighbour on each side
      d.dx = Math.max(-d.span, Math.min(d.span, dx));
      d.trail.push({ dx: d.dx, t: e.timeStamp });
      if (d.trail.length > 6) d.trail.shift();
      if (!frame) frame = requestAnimationFrame(paint);
    };

    const up = (e: PointerEvent) => {
      const d = drag;
      if (!d || e.pointerId !== d.id) return;
      drag = null;
      if (!d.locked) return;
      this.stepsDrag = false;
      cancelAnimationFrame(frame);
      frame = 0;
      // the finger's speed over its last moves (px per ms), signed
      const first = d.trail[0];
      const last = d.trail[d.trail.length - 1];
      const speed = (last.dx - first.dx) / Math.max(16, last.t - first.t);
      const along = Math.sign(speed) === Math.sign(d.dx);
      const go = e.type === 'pointerup' && (Math.abs(d.dx) > d.span * 0.2 || (along && Math.abs(speed) > 0.35 && Math.abs(d.dx) > 16));
      // the glide takes about as long as the finger would have: quick after a flick,
      // unhurried after a slow drag
      const left = go ? d.span - Math.abs(d.dx) : Math.abs(d.dx);
      const ms = Math.round(Math.max(180, Math.min(480, left / Math.max(0.55, Math.abs(speed)))));
      stage.style.setProperty('--snap-dur', `${ms}ms`);
      stage.classList.remove('is-swiping');
      stage.classList.add('is-gliding');
      if (go) {
        // the new places (--k) must be in the page before the dragged offsets come off, or
        // the row would jump back for a frame
        this.zone.run(() => {
          this.stepSlide(d.dx < 0 ? 1 : -1);
          this.cdr.detectChanges();
        });
      }
      for (const c of d.cards) c.el.style.translate = '';
      for (const p of d.photos) p.el.style.opacity = '';
      after = window.setTimeout(() => {
        stage.classList.remove('is-gliding');
        stage.style.removeProperty('--snap-dur');
        for (const p of d.photos) p.el.style.zIndex = '';
      }, ms + 80);
      this.stepsSuppressClick = true;
      window.setTimeout(() => (this.stepsSuppressClick = false), 350);
    };

    // a click that ends a swipe (on the card's link, a pill, the ring) must not also press it:
    // swallowed before any link's own handler (capture phase)
    const click = (e: MouseEvent) => {
      if (!this.stepsSuppressClick) return;
      e.preventDefault();
      e.stopPropagation();
      this.stepsSuppressClick = false;
    };

    // Once, when the cards first come into view on a touch screen: the row leans a little
    // to the side and comes back, to show that it moves.
    let seen: IntersectionObserver | undefined;
    if (window.matchMedia('(hover: none) and (pointer: coarse)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      seen = new IntersectionObserver(
        (entries) => {
          if (!entries.some((en) => en.isIntersecting)) return;
          seen?.disconnect();
          if (this.stepsHinted || intro.classList.contains('is-staged')) return;
          this.stepsHinted = true;
          stage.classList.add('is-hinting');
          window.setTimeout(() => stage.classList.remove('is-hinting'), 1500);
        },
        { threshold: 0.75 },
      );
      seen.observe(box);
    }

    this.zone.runOutsideAngular(() => {
      stage.addEventListener('pointerdown', down, { passive: true });
      stage.addEventListener('pointermove', move, { passive: true });
      stage.addEventListener('pointerup', up);
      stage.addEventListener('pointercancel', up);
      stage.addEventListener('click', click, true);
    });
    destroyRef.onDestroy(() => {
      stage.removeEventListener('pointerdown', down);
      stage.removeEventListener('pointermove', move);
      stage.removeEventListener('pointerup', up);
      stage.removeEventListener('pointercancel', up);
      stage.removeEventListener('click', click, true);
      seen?.disconnect();
      cancelAnimationFrame(frame);
      window.clearTimeout(after);
    });
  }

  private stepsHinted = false;

  // ---- the category carousel around the ring ----
  /** Index of the centred card. */
  protected readonly orbitActive = signal(0);
  protected readonly orbitHover = signal(false);
  /** Keyboard focus is on a card or the ring. It holds the carousel like the pointer does:
   * otherwise the focused card keeps moving and ends up off stage, hidden from screen readers. */
  protected readonly orbitFocus = signal(false);
  protected readonly orbitPaused = computed(() => this.orbitHover() || this.orbitFocus());
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

  /** Only focus that came from the keyboard: a mouse click leaves focus on the ring too, and
   * that one click would stop the carousel until the visitor clicked somewhere else. */
  protected onOrbitFocus(e: FocusEvent): void {
    this.orbitFocus.set((e.target as HTMLElement).matches(':focus-visible'));
  }

  protected onOrbitBlur(e: FocusEvent): void {
    const stage = e.currentTarget as HTMLElement;
    if (!stage.contains(e.relatedTarget as Node | null)) this.orbitFocus.set(false);
  }

  private startOrbit(): void {
    this.stopOrbit();
    this.orbitTimer = window.setInterval(() => {
      if (document.hidden || this.orbitPaused() || this.orbitDrag) return;
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

  /** Browser only: the carousel turns on its own (not under reduced motion) while its section
   * is on screen, and rests while it is not. The section is server HTML until it is scrolled
   * to (@defer, hydrate on viewport), so a timer running from page load would only move a
   * number nobody sees, and the cards would jump to it the moment the section came alive. */
  private setUpOrbit(host: HTMLElement, destroyRef: DestroyRef): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!('IntersectionObserver' in window)) {
      this.orbitAuto = true;
      this.startOrbit();
      destroyRef.onDestroy(() => this.stopOrbit());
      return;
    }
    // (looked up under the host each time: reached from another page, the section is not there yet)
    const section = () => host.querySelector<HTMLElement>('#find');
    let watched: HTMLElement | null = null;
    const io = new IntersectionObserver((entries) => {
      const onScreen = entries.some((e) => e.isIntersecting);
      if (onScreen === this.orbitAuto) return;
      this.orbitAuto = onScreen;
      if (!onScreen) return this.stopOrbit();
      this.startOrbit();
      // the ring's fill is a CSS animation that has been running since the page was drawn:
      // start it again with the timer
      for (const a of section()?.querySelector('.ca__fill')?.getAnimations?.() ?? []) a.currentTime = 0;
    });
    const watch = () => {
      const el = section();
      if (!el || el === watched) return;
      if (watched) io.unobserve(watched);
      io.observe((watched = el));
    };
    watch();
    // a section that arrives later (see above) replaces its placeholder: watch that one
    const arrivals = new MutationObserver(watch);
    arrivals.observe(host.querySelector('.after-hero') ?? host, { childList: true });
    destroyRef.onDestroy(() => {
      io.disconnect();
      arrivals.disconnect();
      this.stopOrbit();
    });
  }
}
