import { Component, PLATFORM_ID, computed, effect, inject, input, output, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { categoryKey, cityName, groupPath } from '../../../core/catalog';
import { KIND_SECTION } from '../../../core/content.models';
import { ChecklistItem, ChecklistService, taskEdit, taskTitle } from '../../../core/checklist.service';
import { CoupleProfile } from '../../../core/couple.service';
import { formatDate } from '../../../core/dates';
import { Overview, OverviewService } from '../../../core/overview.service';
import { PALETTES, Palette, paletteOf } from '../../../core/palettes';
import { PlanPhoto, PlanPhotosService } from '../../../core/plan-photos.service';
import { reminderStatus } from '../../../core/budget.service';
import { byDeadline, isOverdue, taskDue } from '../../../core/task-stages';
import { ContentSections } from '../../../core/content-sections.service';
import { ToastService } from '../../../core/toast.service';
import { LanguageService } from '../../../i18n/language.service';
import { formatGel } from '../../../core/money';

/** The standard banner visual (stage 1) until Taso's (BUILD-PLAN B7 "You provide"). */
const DEFAULT_BANNER = '/media/hero-wide.webp';
/** Charcoal scrim (brand) when no palette is picked. */
const CHARCOAL = '#302B2D';

/**
 * „მიმოხილვა“ (guide §6, BUILD-PLAN B7): the top of the organizer. A personal banner — the standard
 * visual, then the chosen venue's photo, then the couple's palette, then the décor, flower, cake
 * and table photos they marked, laid out by themselves — with the names, date and countdown; the
 * next step; and one block per tool (tasks, budget and payments, services, guests and replies,
 * seating, invitation, wedding day, planning together). Each block opens its tool.
 *
 * Everything but the tasks comes from one summary read (/api/planning/overview); the tasks come
 * from the checklist so they can be ticked here. Browser only: the server has no session.
 */
@Component({
  selector: 'app-couple-overview',
  imports: [RouterLink, TranslatePipe],
  templateUrl: './couple-overview.html',
  styleUrl: './couple-overview.scss',
})
export class CoupleOverview {
  readonly couple = input<CoupleProfile | null>(null);
  /** Bumped by the page after "start over" so the overview reads the new plan. */
  readonly reload = input(0);
  /** "Start over" (the page owns the wizard behind its destructive-action confirm). */
  readonly restart = output<Event>();

  private readonly lang = inject(LanguageService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly overviewSvc = inject(OverviewService);
  private readonly checklist = inject(ChecklistService);
  private readonly toast = inject(ToastService);
  protected readonly planPhotos = inject(PlanPhotosService);
  protected readonly contentSections = inject(ContentSections);
  /** Addresses the template links to: a catalog group's page and the inspiration section. */
  protected readonly groupPath = groupPath;
  protected readonly ideasPath = KIND_SECTION.inspiration;

  protected readonly data = signal<Overview | null>(null);
  protected readonly loadError = signal(false);
  protected readonly tasks = signal<ChecklistItem[]>([]);
  protected readonly tasksLoaded = signal(false);

  constructor() {
    effect(() => {
      void this.reload();
      if (!this.isBrowser) return;
      this.load();
    });
  }

  private load(): void {
    this.loadError.set(false);
    this.overviewSvc.get().subscribe({
      next: (o) => this.data.set(o),
      error: () => this.loadError.set(true),
    });
    this.checklist.list(this.lang.current()).subscribe({
      next: (items) => {
        this.tasks.set(items);
        this.tasksLoaded.set(true);
      },
      error: () => this.loadError.set(true),
    });
  }

  protected retry(): void {
    this.load();
  }

  // ---------------------------------------------------------------- the banner

  protected readonly names = computed(() => {
    const c = this.couple();
    const a = (c?.firstName ?? '').trim();
    const b = (c?.partnerFirstName ?? '').trim();
    return a && b ? `${a} & ${b}` : a || b;
  });

  protected readonly dateLine = computed(() => formatDate(this.couple()?.weddingDate, this.lang.current()));
  protected readonly place = computed(() => {
    const c = this.couple()?.city;
    return c ? cityName(c) : '';
  });

  /** Days to the wedding in Tbilisi time (UTC+4, no DST); null without a date. */
  protected readonly days = computed<number | null>(() => {
    const date = this.couple()?.weddingDate;
    if (!date) return null;
    const [y, m, d] = date.split('-').map(Number);
    if (!y || !m || !d) return null;
    const now = new Date(Date.now() + 4 * 3_600_000);
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return Math.round((Date.UTC(y, m - 1, d) - today) / 86_400_000);
  });

  protected readonly venueName = computed(() => this.data()?.banner.venueName ?? null);
  protected readonly palette = computed<Palette | null>(() => paletteOf(this.data()?.banner.paletteKey));
  /** Marked photos (the shared list, so marking elsewhere shows here at once); the banner shows four. */
  protected readonly photos = computed<PlanPhoto[]>(() => this.planPhotos.photos());
  protected readonly collage = computed(() => this.photos().slice(0, 4));

  /** Which of the four stages the banner has reached (for the customize panel). */
  protected readonly stage = computed(() => {
    if (this.photos().length) return 4;
    if (this.palette()) return 3;
    if (this.data()?.banner.venuePhotoUrl) return 2;
    return 1;
  });

  protected readonly bannerPhoto = computed(() => this.data()?.banner.venuePhotoUrl ?? DEFAULT_BANNER);

  /** The scrim keeps the white text readable; with a palette it takes the palette's deepest colour. */
  protected readonly scrim = computed(() => {
    const deep = this.palette()?.deep ?? CHARCOAL;
    const mix = (pct: number): string => `color-mix(in srgb, ${deep} ${pct}%, transparent)`;
    return `linear-gradient(90deg, ${mix(88)} 0%, ${mix(70)} 38%, ${mix(25)} 72%, ${mix(10)} 100%),`
      + ` linear-gradient(0deg, ${mix(55)} 0%, transparent 45%)`;
  });

  // ---- customizing the banner ----

  protected readonly palettes = PALETTES;
  protected readonly customizing = signal(false);
  protected readonly paletteBusy = signal(false);

  protected toggleCustomize(): void {
    this.customizing.update((v) => !v);
    if (this.customizing() && this.isBrowser) {
      setTimeout(() => document.querySelector<HTMLElement>('.ovc')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    }
  }

  protected pickPalette(key: string | null): void {
    const o = this.data();
    if (!o || this.paletteBusy() || o.banner.paletteKey === key) return;
    const before = o.banner.paletteKey;
    this.paletteBusy.set(true);
    this.data.set({ ...o, banner: { ...o.banner, paletteKey: key } }); // the banner follows at once
    this.overviewSvc.setPalette(key).subscribe({
      next: () => this.paletteBusy.set(false),
      error: () => {
        this.paletteBusy.set(false);
        const now = this.data();
        if (now) this.data.set({ ...now, banner: { ...now.banner, paletteKey: before } });
        this.toast.error('overview.saveError');
      },
    });
  }

  protected sourceName(p: PlanPhoto): string {
    return (this.lang.current() === 'en' && p.sourceNameEn) || p.sourceName || '';
  }

  // ---------------------------------------------------------------- next step

  /**
   * The one most useful next move, in the order a Georgian wedding is usually planned: the
   * budget shapes everything, then the venue, then late tasks, then who's coming, the invitation,
   * the seating and the day. Every check reads real data.
   */
  protected readonly nextStep = computed<{ link: string; key: string } | null>(() => {
    const o = this.data();
    if (!o) return null;
    if (o.budget.total == null) return { link: '/budget', key: 'overview.next.budget' };
    if (!o.banner.venueName) return { link: groupPath('venues'), key: 'overview.next.venue' };
    if (this.overdue() > 0) return { link: '/planning/tasks', key: 'overview.next.overdue' };
    if (o.guests.parties === 0) return { link: '/guests', key: 'overview.next.guests' };
    if (o.invitation.status === 'none') return { link: '/planning/invitation', key: 'overview.next.invitation' };
    if (o.invitation.status === 'draft') return { link: '/planning/invitation', key: 'overview.next.publish' };
    if (o.seating.tables === 0) return { link: '/seating', key: 'overview.next.seating' };
    if (o.day.items === 0) return { link: '/planning/day', key: 'overview.next.day' };
    return null;
  });

  // ---------------------------------------------------------------- tasks

  private readonly wedding = computed(() => this.couple()?.weddingDate ?? null);
  protected readonly done = computed(() => this.tasks().filter((t) => t.isDone).length);
  protected readonly overdue = computed(() => this.tasks().filter((t) => !t.isDone && isOverdue(t, this.wedding())).length);
  protected readonly taskPct = computed(() => (this.tasks().length ? Math.round((this.done() / this.tasks().length) * 100) : 0));
  /** The five open tasks due soonest; all of them live on /planning/tasks. */
  protected readonly nextTasks = computed(() =>
    this.tasks()
      .filter((t) => !t.isDone)
      .sort(byDeadline(this.wedding()))
      .slice(0, 5),
  );

  protected taskDue(t: ChecklistItem): string {
    return formatDate(taskDue(t, this.wedding()), this.lang.current(), 'medium');
  }

  protected title(t: ChecklistItem): string {
    return taskTitle(t, this.lang.current());
  }

  protected taskLate(t: ChecklistItem): boolean {
    return isOverdue(t, this.wedding());
  }

  protected toggleTask(t: ChecklistItem, event: Event): void {
    const next = !t.isDone;
    this.checklist.update(t.id, { ...taskEdit(t), isDone: next }).subscribe({
      next: () => this.tasks.update((list) => list.map((i) => (i.id === t.id ? { ...i, isDone: next } : i))),
      error: () => {
        // The checkbox flipped itself; the binding didn't change, so put it back by hand.
        (event.target as HTMLInputElement).checked = t.isDone;
        this.toast.error('overview.saveError');
      },
    });
  }

  // ---------------------------------------------------------------- the other blocks

  protected readonly paidPct = computed(() => {
    const b = this.data()?.budget;
    if (!b || b.agreed <= 0) return 0;
    return Math.min(100, Math.round((b.paid / b.agreed) * 100));
  });

  protected payBadge(date: string): 'overdue' | 'soon' | null {
    const s = reminderStatus(date);
    return s === 'overdue' || s === 'soon' ? s : null;
  }

  protected readonly seatedPct = computed(() => {
    const s = this.data()?.seating;
    if (!s || s.toSeat <= 0) return 0;
    return Math.min(100, Math.round((s.seated / s.toSeat) * 100));
  });

  protected readonly replyPct = computed(() => {
    const g = this.data()?.guests;
    if (!g || g.invitees <= 0) return 0;
    return Math.round((g.replied / g.invitees) * 100);
  });

  protected readonly members = computed(() => this.couple()?.members ?? []);
  protected readonly partnerJoined = computed(() => this.members().length > 1);

  protected readonly origin = this.isBrowser ? location.host : '';

  protected categoryLabel(slug: string | null): string {
    return slug ? categoryKey(slug) : 'overview.services.ownVendor';
  }

  protected date(iso: string | null | undefined): string {
    return formatDate(iso, this.lang.current(), 'medium');
  }

  protected money(n: number): string {
    return formatGel(n, this.lang.current());
  }
}
