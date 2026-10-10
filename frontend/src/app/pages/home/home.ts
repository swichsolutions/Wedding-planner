import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../core/auth.service';
import { Reveal } from '../../core/reveal.directive';
import { ScrollStage } from '../../core/scroll-stage.directive';
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
  img: string; // the stage photo (desktop) / thumbnail (phones)
}

/** A row with its live inventory folded in (approved vendors summed across the group's slugs). */
interface CategoryRow extends CategoryGroup {
  count: number;
  thumb: string; // small square crop of `img` for the category tile
}

interface ScheduleItem {
  time: string;
  key: string; // i18n key under home.day.item
  optional?: boolean;
  edited?: string; // the one row shown "being edited" → new time
}

@Component({
  selector: 'app-home',
  imports: [RouterLink, TranslatePipe, Reveal, ScrollStage],
  templateUrl: './home.html',
  styleUrl: './home.scss',
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
    afterNextRender(() => {
      this.setUpStrip(destroyRef);
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
  protected readonly venueImg = img('photo-1519225421980-715cb0215aed', 1000);

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
  protected readonly startSlides = [
    { key: 's1', img: '/media/plan-define.webp' }, // couple with a classic car, b&w (local photo, Pexels)
    { key: 's2', img: img('photo-1583939003579-730e3918a45a', 2400) },
    { key: 's3', img: '/media/plan-details.webp?v=2' }, // beach ceremony aisle (local photo, Pexels)
  ];
  protected readonly slide = signal(0);

  /** 03 — the category index: the 14 catalog slugs folded into eight rows. The index
   * is a list with one stage photo that follows the hovered/focused row (desktop) or a
   * thumbnail per row (phones). Inventory comes from the API; a row with no approved
   * vendors falls back to its static blurb instead of showing a zero. */
  private readonly categoryGroups: CategoryGroup[] = [
    { key: 'venues', slugs: ['darbazi'], img: img('photo-1519225421980-715cb0215aed', 900) },
    { key: 'photo', slugs: ['fotografi', 'videografi'], img: img('photo-1606216794074-735e91aa2c92', 900) },
    { key: 'decor', slugs: ['dekori', 'floristi'], img: img('photo-1478146896981-b80fe463b330', 900) },
    { key: 'music', slugs: ['musika'], img: img('photo-1511671782779-c97d3d27a1d4', 900) },
    { key: 'cake', slugs: ['torti'], img: img('photo-1535254973040-607b474cb50d', 900) },
    { key: 'attire', slugs: ['kaba', 'kostiumi', 'bechdebi'], img: img('photo-1594552072238-b8a33785b261', 900) },
    { key: 'beauty', slugs: ['makiaji', 'tmis-stili', 'manikiuri'], img: img('photo-1487412947147-5cebf100ffc2', 900) },
    { key: 'transport', slugs: ['transporti'], img: img('photo-1533473359331-0135ef1b58bf', 900) },
  ];

  private readonly vendors = inject(VendorService);
  private readonly categoryStats = toSignal(this.vendors.categoryStats(), { initialValue: [] as CategoryStat[] });

  protected readonly categoryRows = computed<CategoryRow[]>(() => {
    const bySlug = new Map(this.categoryStats().map((s) => [s.categorySlug, s.count]));
    return this.categoryGroups.map((g) => ({
      ...g,
      count: g.slugs.reduce((n, s) => n + (bySlug.get(s) ?? 0), 0),
      thumb: g.img.replace(/w=\d+/, 'w=128&h=128'),
    }));
  });

  /** Which row the stage photo shows; follows hover/focus, keeps the last one on leave.
   * (Used by the editorial index, currently commented out in the template.) */
  protected readonly activeRow = signal(0);

  /** The reel block: ink background (true) or white (false). */
  protected readonly reelDark = true;

  /** The ring film. Null until the clip exists → the poster photo is shown instead.
   * Drop the MP4 into frontend/public/media and point this at it, e.g. '/media/ring.mp4'. */
  protected readonly reelVideo: string | null = null;

  /** Poster for the film (and the stand-in while there is no clip): a ring on black for
   * the dark block, wedding bands on a bouquet for the white one. */
  protected readonly reelPoster = this.reelDark
    ? img('photo-1605100804763-247f67b3557e', 2400)
    : img('photo-1515934751635-c81c6bc9a2d8', 2400);

  /** False under reduced motion — the poster stays, the film never starts. */
  protected readonly reelPlays = signal(true);

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

  protected readonly faq = ['1', '2', '3', '4', '5'];
  protected readonly gets = ['1', '2', '3'];
}
