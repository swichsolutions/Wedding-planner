import { Component, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { cityName } from '../../core/catalog';
import { LanguageService } from '../../i18n/language.service';
import { ConfirmService } from '../../core/confirm.service';
import { CoupleProfile, CoupleService } from '../../core/couple.service';
import { downloadBlob, qrPng, qrShape, QrShape } from '../../core/qr';
import { ToastService } from '../../core/toast.service';
import { WeddingDayService } from '../../core/wedding-day.service';
import {
  EMPTY_INVITE_EXTRAS,
  INVITE_FONTS,
  InviteeParty,
  SiteScheduleItem,
  WEDDING_TEMPLATES,
  WeddingSite,
  WeddingSiteData,
  WeddingSiteUpdate,
  WebsiteService,
  personalPath,
} from '../../core/website.service';
import { WeddingSite as WeddingSiteView } from '../../components/wedding-site/wedding-site';

/** The guide's seven steps (B6). */
const STEPS = ['design', 'info', 'places', 'details', 'rsvp', 'preview', 'share'] as const;
export type InviteStep = (typeof STEPS)[number];

/** Extra details the couple chooses to show (only chosen ones appear on the invitation). */
const EXTRAS = ['schedule', 'dressCode', 'transport', 'accommodation'] as const;
type Extra = (typeof EXTRAS)[number];

/** Text fields saved when the input loses focus. */
type TextField =
  | 'firstName'
  | 'lastName'
  | 'partnerFirstName'
  | 'partnerLastName'
  | 'weddingDate'
  | 'startTime'
  | 'message'
  | 'place'
  | 'ceremonyName'
  | 'ceremonyAddress'
  | 'ceremonyTime'
  | 'ceremonyMapUrl'
  | 'receptionName'
  | 'receptionAddress'
  | 'receptionTime'
  | 'receptionMapUrl'
  | 'dressCode'
  | 'transport'
  | 'accommodation'
  | 'rsvpDeadline'
  | 'rsvpQuestion';

type InfoField = 'firstName' | 'lastName' | 'partnerFirstName' | 'partnerLastName' | 'weddingDate' | 'startTime';

/** Info fields prefilled from the plan (start form / settings). */
const PREFILL_FIELDS = ['firstName', 'lastName', 'partnerFirstName', 'partnerLastName', 'weddingDate'] as const;

const MAX_SCHEDULE = 12;
const MAX_PHOTOS = 6;
/** The desktop preview renders the invitation this wide, then zooms it to fit. */
const DESKTOP_WIDTH = 1200;

/**
 * „მოსაწვევი“ (guide §6, B6, D7: the wedding-website builder grown into the invitation). Seven
 * steps: design → info → places → extra details → RSVP → phone/desktop preview and publish →
 * share (the general link, a personal link per family or lone guest, QR codes). Later edits
 * update the same link. On the brand theme; the invitation itself keeps its own design.
 */
@Component({
  selector: 'app-website-builder',
  imports: [RouterLink, TranslatePipe, WeddingSiteView],
  templateUrl: './website-builder.html',
  styleUrl: './website-builder.scss',
  host: {
    class: 'theme-brand',
    '(window:resize)': 'scheduleMeasure()',
  },
})
export class WebsiteBuilder {
  private readonly svc = inject(WebsiteService);
  private readonly coupleSvc = inject(CoupleService);
  private readonly daySvc = inject(WeddingDayService);
  private readonly toast = inject(ToastService);
  private readonly confirmSvc = inject(ConfirmService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly steps = STEPS;
  protected readonly extras = EXTRAS;
  protected readonly templates = WEDDING_TEMPLATES;
  protected readonly fonts = INVITE_FONTS;
  protected readonly maxPhotos = MAX_PHOTOS;
  protected readonly maxSchedule = MAX_SCHEDULE;

  protected readonly loaded = signal(false);
  protected readonly loadError = signal(false);
  protected readonly site = signal<WeddingSite | null>(null);
  /** The design picked before the invitation exists (step 1 of a new one). */
  protected readonly pickedTemplate = signal<string>('glow');
  protected readonly step = signal<InviteStep>('design');

  protected readonly stepIndex = computed(() => STEPS.indexOf(this.step()));

  /** Sample data for the design thumbnails. */
  private readonly lang = inject(LanguageService);
  private readonly sampleKa: WeddingSiteData = {
    ...EMPTY_INVITE_EXTRAS,
    firstName: 'ნინო',
    partnerFirstName: 'გიორგი',
    weddingDate: `${new Date().getFullYear() + 1}-06-15`,
    place: 'თბილისი',
    message: null,
    photoUrl: null,
  };
  private readonly sampleEn: WeddingSiteData = { ...this.sampleKa, firstName: 'Nino', partnerFirstName: 'Giorgi', place: 'Tbilisi' };
  protected get sample(): WeddingSiteData {
    return this.lang.current() === 'en' ? this.sampleEn : this.sampleKa;
  }

  /** What the preview shows: the invitation as saved, or the sample while a new one is set up. */
  protected readonly previewData = computed<WeddingSiteData>(() => {
    const s = this.site();
    if (!s) {
      return {
        ...this.sample,
        firstName: this.info.firstName() || this.sample.firstName,
        partnerFirstName: this.info.partnerFirstName() || this.sample.partnerFirstName,
        weddingDate: this.info.weddingDate() || this.sample.weddingDate,
        startTime: this.info.startTime() || null,
      };
    }
    return s;
  });
  protected readonly previewTemplate = computed(() => this.site()?.templateKey ?? this.pickedTemplate());

  constructor() {
    const t = this.translate;
    inject(Title).setTitle(`${t.instant('invitation.title')} | ${t.instant('brand.name')}`);
    inject(Meta).updateTag({ name: 'robots', content: 'noindex' });

    const askedStep = inject(ActivatedRoute).snapshot.queryParamMap.get('step') as InviteStep | null;

    if (this.isBrowser) {
      this.svc.get().subscribe({
        next: (s) => {
          this.site.set(s);
          this.loaded.set(true);
          if (s) {
            this.openExtras(s);
            this.scheduleDraft.set(s.schedule.map((l) => ({ ...l })));
            this.go(askedStep && STEPS.includes(askedStep) ? askedStep : s.isPublished ? 'share' : 'design');
          }
        },
        error: () => this.loadError.set(true),
      });
      this.coupleSvc.me().subscribe({ next: (c) => this.prefill(c), error: () => {} });
    }

    // Re-measure the photo frame and the desktop preview when the design, the photo or the step
    // changes.
    effect(() => {
      void this.site()?.templateKey;
      void this.site()?.photoUrl;
      void this.step();
      void this.device();
      this.scheduleMeasure();
    });
  }

  protected retryLoad(): void {
    this.loadError.set(false);
    this.svc.get().subscribe({
      next: (s) => {
        this.site.set(s);
        this.loaded.set(true);
      },
      error: () => this.loadError.set(true),
    });
  }

  // ---- steps ----

  /** Steps after „ინფორმაცია“ need the invitation to exist. */
  protected canOpen(step: InviteStep): boolean {
    return !!this.site() || step === 'design' || step === 'info';
  }

  protected go(step: InviteStep): void {
    if (!this.canOpen(step)) return;
    this.step.set(step);
    if (step === 'share') this.loadParties();
    if (!this.isBrowser) return;
    void this.router.navigate([], { queryParams: { step }, queryParamsHandling: 'merge', replaceUrl: true });
    document.querySelector('.ib-steps')?.scrollIntoView({ block: 'nearest' });
  }

  protected next(): void {
    const i = this.stepIndex();
    if (i < STEPS.length - 1) this.go(STEPS[i + 1]);
  }

  protected back(): void {
    const i = this.stepIndex();
    if (i > 0) this.go(STEPS[i - 1]);
  }

  // ---- a new invitation: design, then info ----

  /** Info fields before the invitation exists, prefilled from the plan; typing always wins over a
   * late prefill. */
  protected readonly info = {
    firstName: signal(''),
    lastName: signal(''),
    partnerFirstName: signal(''),
    partnerLastName: signal(''),
    weddingDate: signal(''),
    startTime: signal(''),
  };
  private readonly infoTouched = new Set<InfoField>();
  private prefillPlace: string | null = null;

  private prefill(c: CoupleProfile): void {
    for (const field of PREFILL_FIELDS) {
      const value = c[field];
      if (value && !this.infoTouched.has(field)) this.info[field].set(value);
    }
    if (c.city) this.prefillPlace = cityName(c.city);
  }

  protected onInfoInput(field: InfoField, event: Event): void {
    this.infoTouched.add(field);
    this.info[field].set((event.target as HTMLInputElement).value);
  }

  protected pick(template: string): void {
    const s = this.site();
    if (s) {
      if (template !== s.templateKey) this.commit({ templateKey: template });
    } else {
      this.pickedTemplate.set(template);
    }
  }

  protected readonly creating = signal(false);

  protected create(): void {
    if (this.creating()) return;
    this.creating.set(true);
    const seq = ++this.commitSeq;
    const value = (f: InfoField): string | null => this.info[f]().trim() || null;
    this.svc
      .update({
        ...this.payload({
          ...EMPTY_INVITE_EXTRAS,
          templateKey: this.pickedTemplate(),
          firstName: value('firstName'),
          lastName: value('lastName'),
          partnerFirstName: value('partnerFirstName'),
          partnerLastName: value('partnerLastName'),
          weddingDate: value('weddingDate'),
          startTime: value('startTime'),
          place: this.prefillPlace,
          message: null,
          photoUrl: null,
          isPublished: false,
          slug: null,
          rsvpEnabled: true,
          rsvpAskDiet: true,
          rsvpAskMessage: true,
          rsvpQuestion: null,
        }),
        schedule: null,
      })
      .subscribe({
        next: (s) => {
          if (seq === this.commitSeq) this.site.set(s);
          this.creating.set(false);
          this.go('places');
        },
        error: () => {
          this.creating.set(false);
          this.toast.error('website.saveError');
        },
      });
  }

  // ---- saving ----

  /**
   * Monotonic commit sequence — only the latest mutation may write or roll back site(), so a
   * slow save settling late can't undo a newer one (e.g. flip a just-published invitation back
   * to a draft). Every mutation bumps it.
   */
  private commitSeq = 0;

  private payload(s: WeddingSite): WeddingSiteUpdate {
    return {
      templateKey: s.templateKey,
      firstName: s.firstName,
      lastName: s.lastName,
      partnerFirstName: s.partnerFirstName,
      partnerLastName: s.partnerLastName,
      weddingDate: s.weddingDate,
      place: s.place,
      message: s.message,
      inkColor: s.inkColor,
      accentColor: s.accentColor,
      photoFocusX: s.photoFocusX,
      photoFocusY: s.photoFocusY,
      startTime: s.startTime,
      fontKey: s.fontKey,
      ceremonyName: s.ceremonyName,
      ceremonyAddress: s.ceremonyAddress,
      ceremonyTime: s.ceremonyTime,
      ceremonyMapUrl: s.ceremonyMapUrl,
      receptionName: s.receptionName,
      receptionAddress: s.receptionAddress,
      receptionTime: s.receptionTime,
      receptionMapUrl: s.receptionMapUrl,
      dressCode: s.dressCode,
      transport: s.transport,
      accommodation: s.accommodation,
      schedule: s.schedule,
      rsvpEnabled: s.rsvpEnabled,
      rsvpDeadline: s.rsvpDeadline,
      rsvpAskDiet: s.rsvpAskDiet,
      rsvpAskMessage: s.rsvpAskMessage,
      rsvpQuestion: s.rsvpQuestion,
    };
  }

  private commit(changes: Partial<WeddingSite>): void {
    const s = this.site();
    if (!s) return;
    const next = { ...s, ...changes };
    this.site.set(next); // optimistic — the preview updates at once
    const seq = ++this.commitSeq;
    this.svc.update(this.payload(next)).subscribe({
      next: (r) => {
        if (seq === this.commitSeq) this.site.set(r);
      },
      error: () => {
        if (seq === this.commitSeq) this.site.set(s);
        this.toast.error('website.saveError');
      },
    });
  }

  protected commitText(field: TextField, event: Event): void {
    const input = event.target as HTMLInputElement | HTMLTextAreaElement;
    const value = input.value.trim() || null;
    if (value === (this.site()?.[field] ?? null)) return;
    if ((field === 'ceremonyMapUrl' || field === 'receptionMapUrl') && value && !/^https?:\/\/\S+$/i.test(value)) {
      this.toast.error('invitation.mapUrlError');
      return;
    }
    this.commit({ [field]: value });
  }

  protected setFlag(field: 'rsvpEnabled' | 'rsvpAskDiet' | 'rsvpAskMessage', event: Event): void {
    this.commit({ [field]: (event.target as HTMLInputElement).checked });
  }

  protected setFont(key: string | null): void {
    if (key !== this.site()?.fontKey) this.commit({ fontKey: key });
  }

  // ---- colours ----

  /** Curated text-color swatches (wedding-safe inks, light and dark). */
  protected readonly inkSwatches = ['#1c1714', '#5d4037', '#22314f', '#571e2a', '#3c4636', '#f6f1e7'];

  /** Curated accent swatches (gold, rose, terracotta, sage, teal, silver). */
  protected readonly accentSwatches = ['#c8a96a', '#d98b94', '#c26d54', '#75855f', '#4f93a3', '#b9b3a6'];

  /** Warn (never block) when a custom text color reads poorly on the design's background. */
  protected readonly lowContrast = computed(() => {
    const s = this.site();
    if (!s?.inkColor) return false;
    const bg = THEME_BG[s.templateKey] ?? '#ffffff';
    return contrastRatio(s.inkColor, bg) < 3;
  });

  protected setColor(field: 'inkColor' | 'accentColor', value: string | null): void {
    if (value !== this.site()?.[field]) this.commit({ [field]: value });
  }

  protected onColorInput(field: 'inkColor' | 'accentColor', event: Event): void {
    this.setColor(field, (event.target as HTMLInputElement).value || null);
  }

  // ---- photos ----

  protected readonly photoBusy = signal(false);

  protected onPhoto(input: HTMLInputElement): void {
    const file = input.files?.[0];
    if (!file || this.photoBusy()) return;
    this.photoBusy.set(true);
    const seq = ++this.commitSeq;
    this.svc.uploadPhoto(file).subscribe({
      next: (s) => {
        if (seq === this.commitSeq) this.site.set(s);
        this.photoBusy.set(false);
        input.value = '';
      },
      error: () => {
        this.photoBusy.set(false);
        input.value = '';
        this.toast.error('invitation.photoError');
      },
    });
  }

  protected removePhoto(): void {
    if (this.photoBusy()) return;
    this.photoBusy.set(true);
    const seq = ++this.commitSeq;
    this.svc.removePhoto().subscribe({
      next: (s) => {
        if (seq === this.commitSeq) this.site.set(s);
        this.photoBusy.set(false);
      },
      error: () => {
        this.photoBusy.set(false);
        this.toast.error('website.saveError');
      },
    });
  }

  /** Gallery: several files at once, one after another, up to the limit. */
  protected onGallery(input: HTMLInputElement): void {
    const room = MAX_PHOTOS - (this.site()?.photos.length ?? 0);
    const files = Array.from(input.files ?? []).slice(0, Math.max(0, room));
    input.value = '';
    if (!files.length || this.photoBusy()) return;
    this.photoBusy.set(true);
    const upload = (i: number): void => {
      if (i >= files.length) {
        this.photoBusy.set(false);
        return;
      }
      const seq = ++this.commitSeq;
      this.svc.addGalleryPhoto(files[i]).subscribe({
        next: (s) => {
          if (seq === this.commitSeq) this.site.set(s);
          upload(i + 1);
        },
        error: () => {
          this.photoBusy.set(false);
          this.toast.error('invitation.photoError');
        },
      });
    };
    upload(0);
  }

  protected removeGalleryPhoto(id: number): void {
    if (this.photoBusy()) return;
    this.photoBusy.set(true);
    const seq = ++this.commitSeq;
    this.svc.removeGalleryPhoto(id).subscribe({
      next: (s) => {
        if (seq === this.commitSeq) this.site.set(s);
        this.photoBusy.set(false);
      },
      error: () => {
        this.photoBusy.set(false);
        this.toast.error('website.saveError');
      },
    });
  }

  // ---- photo focal point ----

  /**
   * Each design crops the photo to its own shape; the focal point (percent) stays in frame.
   * Dragging updates the preview live and saves on release; arrow keys nudge it.
   */
  protected readonly focusDragging = signal(false);
  private focusSaveTimer: ReturnType<typeof setTimeout> | null = null;

  protected startFocusDrag(event: PointerEvent): void {
    if (!this.site()?.photoUrl) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.focusDragging.set(true);
    this.applyFocusFromPointer(event);
  }

  protected moveFocusDrag(event: PointerEvent): void {
    if (this.focusDragging()) this.applyFocusFromPointer(event);
  }

  protected endFocusDrag(): void {
    if (!this.focusDragging()) return;
    this.focusDragging.set(false);
    this.saveFocus();
  }

  protected nudgeFocus(event: Event, dx: number, dy: number): void {
    const s = this.site();
    if (!s?.photoUrl) return;
    event.preventDefault();
    this.setFocusLocal(clampPct((s.photoFocusX ?? 50) + dx), clampPct((s.photoFocusY ?? 50) + dy));
    if (this.focusSaveTimer) clearTimeout(this.focusSaveTimer);
    this.focusSaveTimer = setTimeout(() => this.saveFocus(), 600);
  }

  private applyFocusFromPointer(event: PointerEvent): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.setFocusLocal(
      clampPct(((event.clientX - rect.left) / rect.width) * 100),
      clampPct(((event.clientY - rect.top) / rect.height) * 100),
    );
  }

  private setFocusLocal(x: number, y: number): void {
    const s = this.site();
    if (s) this.site.set({ ...s, photoFocusX: x, photoFocusY: y });
  }

  private saveFocus(): void {
    const s = this.site();
    if (s) this.commit({ photoFocusX: s.photoFocusX ?? 50, photoFocusY: s.photoFocusY ?? 50 });
  }

  /**
   * object-fit: cover crops one axis only — which depends on the photo's shape against the
   * design's frame. The picker outlines the part the current design shows, measured from the
   * live preview's rendered photo.
   */
  private readonly measured = signal<{ frameRatio: number; photoRatio: number } | null>(null);
  private measureTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly cropRect = computed(() => {
    const m = this.measured();
    const s = this.site();
    if (!m || !s?.photoUrl) return null;
    const x = s.photoFocusX ?? 50;
    const y = s.photoFocusY ?? 50;
    if (m.photoRatio > m.frameRatio + 0.01) {
      const w = (m.frameRatio / m.photoRatio) * 100;
      return { left: (x / 100) * (100 - w), top: 0, width: w, height: 100 };
    }
    if (m.photoRatio < m.frameRatio - 0.01) {
      const h = (m.photoRatio / m.frameRatio) * 100;
      return { left: 0, top: (y / 100) * (100 - h), width: 100, height: h };
    }
    return null;
  });

  protected scheduleMeasure(): void {
    if (!this.isBrowser) return;
    if (this.measureTimer) clearTimeout(this.measureTimer);
    this.measureTimer = setTimeout(() => {
      this.measureCropFrame();
      this.measureDesktop();
    }, 150);
  }

  private measureCropFrame(): void {
    // The hero photo of the live preview: the first image (the gallery comes later in the page).
    const img = document.querySelector<HTMLImageElement>('.ib-live .ws img');
    if (!img) {
      this.measured.set(null);
      return;
    }
    if (!img.complete) {
      img.addEventListener('load', () => this.measureCropFrame(), { once: true });
      return;
    }
    const ok = img.clientWidth && img.clientHeight && img.naturalWidth && img.naturalHeight;
    this.measured.set(
      ok ? { frameRatio: img.clientWidth / img.clientHeight, photoRatio: img.naturalWidth / img.naturalHeight } : null,
    );
  }

  // ---- step 3: places ----

  protected readonly placeKinds = ['ceremony', 'reception'] as const;

  protected placeField(kind: 'ceremony' | 'reception', part: 'Name' | 'Address' | 'Time' | 'MapUrl'): TextField {
    return `${kind}${part}` as TextField;
  }

  // ---- step 4: extra details ----

  /** Which extras are switched on. Turning one off hides it from the invitation; its text is kept
   * here, so turning it back on in this visit restores it. */
  protected readonly extraOn = signal<Record<Extra, boolean>>({
    schedule: false,
    dressCode: false,
    transport: false,
    accommodation: false,
  });
  private readonly extraStash: Partial<Record<Extra, string | SiteScheduleItem[]>> = {};

  private openExtras(s: WeddingSite): void {
    this.extraOn.set({
      schedule: s.schedule.length > 0,
      dressCode: !!s.dressCode,
      transport: !!s.transport,
      accommodation: !!s.accommodation,
    });
  }

  protected toggleExtra(key: Extra, event: Event): void {
    const on = (event.target as HTMLInputElement).checked;
    this.extraOn.update((x) => ({ ...x, [key]: on }));
    const s = this.site();
    if (!s) return;
    if (key === 'schedule') {
      if (on) {
        const back = (this.extraStash.schedule as SiteScheduleItem[] | undefined) ?? [];
        this.scheduleDraft.set(back.length ? back : [{ time: null, text: '' }]);
        if (back.length) this.commit({ schedule: back });
      } else {
        this.extraStash.schedule = this.scheduleDraft().filter((l) => l.text.trim());
        this.scheduleDraft.set([]);
        if (s.schedule.length) this.commit({ schedule: [] });
      }
      return;
    }
    if (on) {
      const back = this.extraStash[key] as string | undefined;
      if (back) this.commit({ [key]: back });
    } else {
      if (s[key]) this.extraStash[key] = s[key]!;
      if (s[key]) this.commit({ [key]: null });
    }
  }

  /** The schedule as edited, including a new empty line; only lines with text are saved. */
  protected readonly scheduleDraft = signal<SiteScheduleItem[]>([]);

  protected editLine(i: number, part: 'time' | 'text', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.scheduleDraft.update((list) =>
      list.map((l, j) => (j === i ? { ...l, [part]: part === 'time' ? value || null : value } : l)),
    );
    this.saveSchedule();
  }

  protected addLine(): void {
    if (this.scheduleDraft().length >= MAX_SCHEDULE) return;
    this.scheduleDraft.update((list) => [...list, { time: null, text: '' }]);
    setTimeout(() => document.querySelector<HTMLInputElement>('.ib-sched__row:last-child input[type=time]')?.focus());
  }

  protected removeLine(i: number): void {
    this.scheduleDraft.update((list) => list.filter((_, j) => j !== i));
    this.saveSchedule();
  }

  private saveSchedule(): void {
    const lines = this.scheduleDraft()
      .filter((l) => l.text.trim())
      .map((l) => ({ time: l.time, text: l.text.trim().slice(0, 120) }));
    const now = this.site()?.schedule ?? [];
    if (JSON.stringify(lines) !== JSON.stringify(now)) this.commit({ schedule: lines });
  }

  /** Fill the short schedule from „ქორწილის დღე“ (activities and times only — no contacts). */
  protected importDay(): void {
    this.daySvc.list().subscribe({
      next: (items) => {
        const lines = items
          .filter((d) => d.activity.trim())
          .slice(0, MAX_SCHEDULE)
          .map((d) => ({ time: d.time, text: d.activity.trim().slice(0, 120) }));
        if (!lines.length) {
          this.toast.show('invitation.dayEmpty', 'info', 6000);
          return;
        }
        const apply = (): void => {
          this.scheduleDraft.set(lines);
          this.saveSchedule();
        };
        if (!this.scheduleDraft().some((l) => l.text.trim())) {
          apply();
          return;
        }
        void this.confirmSvc
          .confirm({ title: 'invitation.dayReplaceTitle', body: 'invitation.dayReplaceBody', confirmLabel: 'invitation.dayReplace' })
          .then((ok) => ok && apply());
      },
      error: () => this.toast.error('website.saveError'),
    });
  }

  // ---- step 6: preview and publish ----

  protected readonly device = signal<'phone' | 'desktop'>('phone');
  protected readonly desktopWidth = DESKTOP_WIDTH;
  /** Zoom of the desktop preview so 1200px fits the frame (0 until measured). */
  protected readonly desktopZoom = signal(0);

  private measureDesktop(): void {
    const frame = document.querySelector<HTMLElement>('.ib-device--desktop');
    if (!frame) return;
    const style = getComputedStyle(frame);
    const inner = frame.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    if (inner > 0) this.desktopZoom.set(Math.min(1, inner / DESKTOP_WIDTH));
  }

  protected readonly publishBusy = signal(false);

  protected publish(): void {
    if (this.publishBusy()) return;
    const s = this.site();
    if (!s?.firstName?.trim() || !s.partnerFirstName?.trim() || !s.weddingDate) {
      this.toast.error('invitation.publishIncomplete');
      this.go('info');
      return;
    }
    this.publishBusy.set(true);
    const seq = ++this.commitSeq;
    this.svc.publish().subscribe({
      next: (s) => {
        if (seq === this.commitSeq) this.site.set(s);
        this.publishBusy.set(false);
        this.toast.success('invitation.publishedToast');
        this.go('share');
      },
      error: () => {
        this.publishBusy.set(false);
        this.toast.error('website.saveError');
      },
    });
  }

  protected unpublish(): void {
    if (this.publishBusy()) return;
    void this.confirmSvc
      .confirm({
        title: 'invitation.unpublishTitle',
        body: 'invitation.unpublishBody',
        confirmLabel: 'website.unpublish',
        danger: true,
      })
      .then((ok) => {
        if (!ok) return;
        this.publishBusy.set(true);
        const seq = ++this.commitSeq;
        this.svc.unpublish().subscribe({
          next: (s) => {
            if (seq === this.commitSeq) this.site.set(s);
            this.publishBusy.set(false);
          },
          error: () => {
            this.publishBusy.set(false);
            this.toast.error('website.saveError');
          },
        });
      });
  }

  // ---- step 7: share ----

  private readonly origin = this.isBrowser ? location.origin : '';

  protected readonly siteUrl = computed(() => {
    const slug = this.site()?.slug;
    return slug ? `${this.origin}/w/${slug}` : '';
  });

  protected partyUrl(p: InviteeParty): string {
    const slug = this.site()?.slug;
    return slug ? `${this.origin}${personalPath(slug, p.code)}` : '';
  }

  protected readonly parties = signal<InviteeParty[] | null>(null);
  protected readonly partiesError = signal(false);
  protected readonly canShare = this.isBrowser && typeof navigator.share === 'function';

  protected readonly replied = computed(() => (this.parties() ?? []).filter((p) => p.rsvpAt).length);

  private loadParties(): void {
    this.partiesError.set(false);
    this.svc.parties().subscribe({
      next: (list) => this.parties.set(list),
      error: () => this.partiesError.set(true),
    });
  }

  /** The general link's QR, drawn once per link. */
  protected readonly qr = signal<QrShape | null>(null);
  private qrFor = '';

  private readonly drawQr = effect(() => {
    const url = this.siteUrl();
    if (!this.isBrowser || !url || this.step() !== 'share' || this.qrFor === url) return;
    this.qrFor = url;
    void qrShape(url).then((q) => this.qr.set(q));
  });

  protected copy(url: string): void {
    if (!url || !this.isBrowser) return;
    void navigator.clipboard?.writeText(url).then(
      () => this.toast.success('website.copied'),
      () => this.toast.error('invitation.copyError'),
    );
  }

  /** The invitation text with the link, ready for a message to the family. */
  protected copyText(p: InviteeParty): void {
    this.copy(this.translate.instant('invitation.shareText', { link: this.partyUrl(p) }));
  }

  protected share(url: string, name: string | null): void {
    if (!this.canShare || !url) return;
    navigator
      .share({ title: this.translate.instant('invitation.shareTitle'), text: name ?? undefined, url })
      .catch(() => {});
  }

  protected async downloadQr(url: string, name: string | null): Promise<void> {
    if (!url) return;
    const blob = await qrPng(url, name);
    if (!blob) {
      this.toast.error('website.saveError');
      return;
    }
    const base = this.translate.instant('invitation.qrFile');
    const tail = name ? `-${name.replace(/[\\/:*?"<>|]+/g, '').trim().replace(/\s+/g, '-')}` : '';
    downloadBlob(blob, `${base}${tail}.png`);
  }
}

function clampPct(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

// Dominant background per design (gradients approximated by their top color) —
// used only for the readability warning on custom text colors.
const THEME_BG: Record<string, string> = {
  glow: '#1d2a44',
  calligraphy: '#fcfaf5',
  garnet: '#571e2a',
  forest: '#22372c',
  seaside: '#f2fafa',
  minimal: '#ffffff',
  blush: '#fbeeea',
  vineyard: '#e9ede2',
  midnight: '#121212',
  sunrise: '#fddcc0',
  minankari: '#1b2f5e',
  pardagi: '#802b26',
  pearl: '#f4f1eb',
  tbilisi: '#f7ead6',
};

/** WCAG contrast ratio between two '#rrggbb' colors. */
function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const channel = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}
