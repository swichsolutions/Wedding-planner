import { Component, DestroyRef, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { trapTabKey } from '../../core/a11y';
import { AuthService } from '../../core/auth.service';
import { img } from '../../core/catalog';
import { CoupleProfile, CoupleService } from '../../core/couple.service';
import { ToastService } from '../../core/toast.service';
import {
  WEDDING_TEMPLATES,
  WeddingSite,
  WeddingSiteData,
  WeddingSiteUpdate,
  WebsiteService,
} from '../../core/website.service';
import { WeddingSite as WeddingSiteView } from '../../components/wedding-site/wedding-site';

/**
 * Wedding-website builder (The Knot-style): pick a design → add your info →
 * live-edit the site → publish to a public /w/{slug} link.
 */
@Component({
  selector: 'app-website-builder',
  imports: [RouterLink, TranslatePipe, WeddingSiteView],
  templateUrl: './website-builder.html',
  styleUrl: './website-builder.scss',
  host: {
    '(document:keydown.escape)': 'onEscape()',
    '(window:resize)': 'scheduleMeasure()',
  },
})
export class WebsiteBuilder {
  private readonly auth = inject(AuthService);
  private readonly svc = inject(WebsiteService);
  private readonly coupleSvc = inject(CoupleService);
  private readonly toast = inject(ToastService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly isCouple = this.auth.isCouple;
  protected readonly templates = WEDDING_TEMPLATES;

  protected readonly loaded = signal(false);
  protected readonly loadError = signal(false);
  protected readonly site = signal<WeddingSite | null>(null);
  protected readonly pickedTemplate = signal<string | null>(null);

  /**
   * Info-step field model. Prefilled from the couple-profile fetch when it
   * arrives — but a field the user has already typed in is never overwritten
   * (the fetch can resolve slowly, after typing has begun; live-binding the
   * inputs straight to the fetch used to replace typed text).
   */
  protected readonly info = {
    firstName: signal(''),
    lastName: signal(''),
    partnerFirstName: signal(''),
    partnerLastName: signal(''),
    weddingDate: signal(''),
  };
  private readonly infoTouched = new Set<InfoField>();

  protected onInfoInput(field: InfoField, event: Event): void {
    this.infoTouched.add(field);
    this.info[field].set((event.target as HTMLInputElement).value);
  }

  private prefillInfo(c: CoupleProfile): void {
    for (const field of Object.keys(this.info) as InfoField[]) {
      const value = c[field];
      if (value && !this.infoTouched.has(field)) this.info[field].set(value);
    }
  }

  protected readonly creating = signal(false);
  protected readonly photoBusy = signal(false);
  protected readonly publishBusy = signal(false);
  protected readonly showPublished = signal(false);

  /** pick → info → edit; the site's existence drives the flow. */
  protected readonly stage = computed<'pick' | 'info' | 'edit'>(() => {
    if (this.site()) return 'edit';
    return this.pickedTemplate() ? 'info' : 'pick';
  });

  /** Sample data rendered in design-gallery thumbnails. */
  protected readonly sample: WeddingSiteData = {
    firstName: 'ნინო',
    partnerFirstName: 'გიორგი',
    weddingDate: `${new Date().getFullYear() + 1}-06-15`,
    place: 'თბილისი',
    message: null,
    inkColor: null,
    accentColor: null,
    photoUrl: null,
    photoFocusX: null,
    photoFocusY: null,
  };

  /**
   * Guest-teaser cards: one design per layout family, dark/light moods balanced,
   * each dressed with a real photo so the card reads as a finished site.
   */
  protected readonly teaser: { template: string; data: WeddingSiteData }[] = [
    { template: 'glow', data: { ...this.sample, photoUrl: img('photo-1606800052052-a08af7148866', 900), photoFocusY: 35 } },
    { template: 'blush', data: { ...this.sample, photoUrl: img('photo-1519741497674-611481863552', 900) } },
    { template: 'calligraphy', data: { ...this.sample, photoUrl: img('photo-1470019693664-1d202d2c0907', 900) } },
    { template: 'midnight', data: { ...this.sample, photoUrl: img('photo-1465495976277-4387d4b0b4c6', 900) } },
  ];

  /** The design open in the guest preview dialog (null = closed). */
  protected readonly peek = signal<{ template: string; data: WeddingSiteData } | null>(null);
  private peekTrigger: HTMLElement | null = null;

  /**
   * The preview renders the site at a fixed desktop width, then scales it down so
   * the ENTIRE page fits the dialog — a poster view, no scrolling. Scale 0 hides
   * the stage until the first measurement lands.
   */
  protected readonly peekWidth = 1100;
  protected readonly peekScale = signal(0);
  protected readonly peekHeight = signal(0);

  protected readonly previewData = computed<WeddingSiteData>(() => {
    const s = this.site();
    return {
      firstName: s?.firstName ?? null,
      partnerFirstName: s?.partnerFirstName ?? null,
      weddingDate: s?.weddingDate ?? null,
      place: s?.place ?? null,
      message: s?.message ?? null,
      inkColor: s?.inkColor ?? null,
      accentColor: s?.accentColor ?? null,
      photoUrl: s?.photoUrl ?? null,
      photoFocusX: s?.photoFocusX ?? null,
      photoFocusY: s?.photoFocusY ?? null,
    };
  });

  // ---- color customization ----

  /** Curated text-color swatches (wedding-safe inks, light and dark). */
  protected readonly inkSwatches = ['#1c1714', '#5d4037', '#22314f', '#571e2a', '#3c4636', '#f6f1e7'];

  /** Curated accent swatches (gold, rose, terracotta, sage, teal, silver, brand pink). */
  protected readonly accentSwatches = ['#c8a96a', '#d98b94', '#c26d54', '#75855f', '#4f93a3', '#b9b3a6', '#ff3fa4'];

  /** Warn (never block) when a custom text color reads poorly on the theme background. */
  protected readonly lowContrast = computed(() => {
    const s = this.site();
    if (!s?.inkColor) return false;
    const bg = THEME_BG[s.templateKey] ?? '#ffffff';
    return contrastRatio(s.inkColor, bg) < 3;
  });

  protected readonly siteUrl = computed(() => {
    const slug = this.site()?.slug;
    if (!slug) return '';
    const origin = this.isBrowser ? location.origin : '';
    return `${origin}/w/${slug}`;
  });

  constructor() {
    const t = inject(TranslateService);
    inject(Title).setTitle(`${t.instant('website.title')} | ${t.instant('brand.name')}`);
    inject(Meta).updateTag({ name: 'description', content: t.instant('website.guestBody') });

    // Leaving the page with a dialog open must not strand the body scroll lock.
    inject(DestroyRef).onDestroy(() => {
      if (this.isBrowser) document.body.style.overflow = '';
    });

    // Load when isCouple() BECOMES true, not only when it already is at
    // construction — a guest who signs in via the navbar modal on this page
    // (or a signed-in user whose auth state settles after hydration) must get
    // the builder without a refresh. The latch keeps it a one-time load.
    effect(() => {
      if (!this.isBrowser || !this.isCouple() || this.coupleLoadStarted) return;
      this.coupleLoadStarted = true;
      this.svc.get().subscribe({
        next: (s) => {
          this.site.set(s);
          this.loaded.set(true);
        },
        error: () => this.loadError.set(true),
      });
      this.coupleSvc.me().subscribe({
        next: (c) => this.prefillInfo(c),
        error: () => {},
      });
    });

    // Re-measure the preview's photo frame whenever the design or photo changes —
    // the crop indicator in the focal picker depends on the rendered geometry.
    // (scheduleMeasure is a no-op on the server and while there's no preview.)
    effect(() => {
      const s = this.site();
      void s?.templateKey;
      void s?.photoUrl;
      this.scheduleMeasure();
    });
  }

  private coupleLoadStarted = false;

  // ---- pick + create ----

  protected pick(template: string): void {
    this.pickedTemplate.set(template);
  }

  protected backToDesigns(): void {
    this.pickedTemplate.set(null);
  }

  protected createSite(
    first: HTMLInputElement,
    last: HTMLInputElement,
    partnerFirst: HTMLInputElement,
    partnerLast: HTMLInputElement,
    date: HTMLInputElement,
    place: HTMLInputElement,
  ): void {
    const template = this.pickedTemplate();
    if (!template || this.creating()) return;
    this.creating.set(true);
    this.commitSeq++; // a stale commit settle must not clobber the created site
    this.svc
      .update({
        templateKey: template,
        firstName: first.value.trim() || null,
        lastName: last.value.trim() || null,
        partnerFirstName: partnerFirst.value.trim() || null,
        partnerLastName: partnerLast.value.trim() || null,
        weddingDate: date.value || null,
        place: place.value.trim() || null,
        message: null,
        inkColor: null,
        accentColor: null,
        photoFocusX: null,
        photoFocusY: null,
      })
      .subscribe({
        next: (s) => {
          this.site.set(s);
          this.creating.set(false);
        },
        error: () => {
          this.creating.set(false);
          this.toast.error('website.saveError');
        },
      });
  }

  // ---- live editing ----

  /**
   * Monotonic commit sequence — only the latest commit may write/roll back site().
   * Rule: EVERY site mutation (create/publish/unpublish/photo upload/remove, not
   * just commit) bumps it, so a stale field-save settling later can't clobber a
   * newer authoritative response — e.g. flip a just-published site back to Draft.
   */
  private commitSeq = 0;

  private commit(changes: Partial<WeddingSiteUpdate>): void {
    const s = this.site();
    if (!s) return;
    const payload: WeddingSiteUpdate = {
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
      ...changes,
    };
    this.site.set({ ...s, ...changes }); // optimistic — the preview updates instantly
    // A stale response (success or failure) must not clobber the state a newer
    // commit already owns — that newer commit's own settle will decide it.
    const seq = ++this.commitSeq;
    this.svc.update(payload).subscribe({
      next: (r) => {
        if (seq === this.commitSeq) this.site.set(r);
      },
      error: () => {
        if (seq === this.commitSeq) this.site.set(s);
        this.toast.error('website.saveError'); // the save DID fail, even if stale
      },
    });
  }

  protected commitField(
    field: 'firstName' | 'lastName' | 'partnerFirstName' | 'partnerLastName' | 'place' | 'message',
    event: Event,
  ): void {
    const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value.trim() || null;
    if (value === this.site()?.[field]) return;
    this.commit({ [field]: value });
  }

  protected commitDate(event: Event): void {
    const value = (event.target as HTMLInputElement).value || null;
    if (value === this.site()?.weddingDate) return;
    this.commit({ weddingDate: value });
  }

  protected switchTemplate(key: string): void {
    if (key === this.site()?.templateKey) return;
    this.commit({ templateKey: key });
  }

  protected setColor(field: 'inkColor' | 'accentColor', value: string | null): void {
    if (value === this.site()?.[field]) return;
    this.commit({ [field]: value });
  }

  protected onColorInput(field: 'inkColor' | 'accentColor', event: Event): void {
    this.setColor(field, (event.target as HTMLInputElement).value || null);
  }

  // ---- photo ----

  protected onPhoto(input: HTMLInputElement): void {
    const file = input.files?.[0];
    if (!file || this.photoBusy()) return;
    this.photoBusy.set(true);
    this.commitSeq++; // a stale commit settle must not clobber the photo response
    this.svc.uploadPhoto(file).subscribe({
      next: (s) => {
        this.site.set(s);
        this.photoBusy.set(false);
        input.value = '';
      },
      error: () => {
        this.photoBusy.set(false);
        input.value = '';
        this.toast.error('website.saveError');
      },
    });
  }

  protected removePhoto(): void {
    if (this.photoBusy()) return;
    this.photoBusy.set(true);
    this.commitSeq++; // a stale commit settle must not resurrect the removed photo
    this.svc.removePhoto().subscribe({
      next: (s) => {
        this.site.set(s);
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
   * Each design crops the photo to its own aspect ratio; the focal point (percent
   * coordinates) is what stays in frame. Dragging updates the preview live and
   * saves once on release; arrow keys on the dot nudge it (debounced save).
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

  /** Preview-only update while dragging — the server save happens once, on release. */
  private setFocusLocal(x: number, y: number): void {
    const s = this.site();
    if (s) this.site.set({ ...s, photoFocusX: x, photoFocusY: y });
  }

  private saveFocus(): void {
    const s = this.site();
    if (!s) return;
    this.commit({ photoFocusX: s.photoFocusX ?? 50, photoFocusY: s.photoFocusY ?? 50 });
  }

  // ---- crop-frame indicator ----

  /**
   * object-fit: cover only ever crops ONE axis — which one depends on the photo's
   * shape vs the design's frame. To make that visible (and explain why the dot has
   * no effect on the fitting axis), the picker highlights the exact region the
   * current design shows, measured from the live preview's real rendered <img>.
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
      // photo is wider than the frame → sides get cropped, the dot slides left/right
      const w = (m.frameRatio / m.photoRatio) * 100;
      return { left: (x / 100) * (100 - w), top: 0, width: w, height: 100 };
    }
    if (m.photoRatio < m.frameRatio - 0.01) {
      // photo is taller than the frame → top/bottom get cropped, the dot slides up/down
      const h = (m.photoRatio / m.frameRatio) * 100;
      return { left: 0, top: (y / 100) * (100 - h), width: 100, height: h };
    }
    return null; // shapes match — nothing is cropped
  });

  /** Debounced: lets Angular render the new template before reading its geometry. */
  protected scheduleMeasure(): void {
    if (!this.isBrowser) return;
    if (this.measureTimer) clearTimeout(this.measureTimer);
    this.measureTimer = setTimeout(() => {
      this.measureCropFrame();
      if (this.peek()) this.measurePeek();
    }, 150);
  }

  private measureCropFrame(): void {
    const img = document.querySelector<HTMLImageElement>('.wb-edit__preview img');
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
      ok
        ? {
            frameRatio: img.clientWidth / img.clientHeight,
            photoRatio: img.naturalWidth / img.naturalHeight,
          }
        : null,
    );
  }

  // ---- publish ----

  protected publish(): void {
    if (this.publishBusy()) return;
    // Captured at click time — the dialog's close restores focus here (or to the
    // bar's action button once "Publish" has been swapped for "Unpublish").
    this.pubTrigger = this.isBrowser ? (document.activeElement as HTMLElement | null) : null;
    this.publishBusy.set(true);
    // A stale commit settling later must not flip the site back to Draft and
    // blank the URL in the "Published!" dialog.
    this.commitSeq++;
    this.svc.publish().subscribe({
      next: (s) => {
        this.site.set(s);
        this.publishBusy.set(false);
        this.showPublished.set(true);
        if (this.isBrowser) {
          this.pubPrevOverflow = document.body.style.overflow;
          document.body.style.overflow = 'hidden';
          // setTimeout so the dialog has rendered before focus moves in.
          setTimeout(() =>
            document.querySelector<HTMLElement>('.wb-pub__actions .btn--primary')?.focus(),
          );
        }
      },
      error: () => {
        this.publishBusy.set(false);
        this.toast.error('website.saveError');
      },
    });
  }

  /** Whatever had focus when the published dialog opened. */
  private pubTrigger: HTMLElement | null = null;
  private pubPrevOverflow = '';

  protected unpublish(): void {
    if (this.publishBusy()) return;
    this.publishBusy.set(true);
    this.commitSeq++; // a stale commit settle must not clobber the unpublish response
    this.svc.unpublish().subscribe({
      next: (s) => {
        this.site.set(s);
        this.publishBusy.set(false);
      },
      error: () => {
        this.publishBusy.set(false);
        this.toast.error('website.saveError');
      },
    });
  }

  protected copyLink(): void {
    const url = this.siteUrl();
    if (!url || !this.isBrowser) return;
    void navigator.clipboard?.writeText(url).then(() => this.toast.success('website.copied'));
  }

  protected closePublished(): void {
    if (!this.showPublished()) return;
    this.showPublished.set(false);
    if (this.isBrowser) {
      document.body.style.overflow = this.pubPrevOverflow;
      // The "Publish" button that opened this no longer exists once the site is
      // live — fall back to the bar's action button ("Unpublish") in that case.
      const target = this.pubTrigger?.isConnected
        ? this.pubTrigger
        : document.querySelector<HTMLElement>('.wb-bar__actions button');
      target?.focus();
    }
    this.pubTrigger = null;
  }

  protected onEscape(): void {
    if (this.peek()) {
      this.closePeek();
      return;
    }
    this.closePublished();
  }

  /** Keep Tab cycling inside whichever dialog is open (overlay wraps the panel). */
  protected onDialogKeydown(event: KeyboardEvent): void {
    trapTabKey(event.currentTarget as HTMLElement, event);
  }

  protected onPublishedOverlay(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closePublished();
  }

  // ---- guest design preview ----

  protected openPeek(card: { template: string; data: WeddingSiteData }, event: Event): void {
    this.peekTrigger = event.currentTarget as HTMLElement;
    this.peek.set(card);
    if (this.isBrowser) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => {
        document.querySelector<HTMLElement>('.wb-peek__close')?.focus();
        this.measurePeek();
      });
    }
  }

  protected closePeek(): void {
    this.peek.set(null);
    this.peekScale.set(0);
    this.peekHeight.set(0);
    if (this.isBrowser) document.body.style.overflow = '';
    this.peekTrigger?.focus();
    this.peekTrigger = null;
  }

  protected onPeekOverlay(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closePeek();
  }

  /**
   * Fit the rendered site to the space the overlay offers (minus the CTA footer);
   * the dialog then hugs the scaled poster exactly. Re-runs as images load.
   */
  private measurePeek(): void {
    const overlay = document.querySelector<HTMLElement>('.wb-peek');
    const stage = document.querySelector<HTMLElement>('.wb-peek__stage');
    const cta = document.querySelector<HTMLElement>('.wb-peek__cta');
    if (!overlay || !stage) return;

    // offsetHeight ignores the transform — it's the natural (unscaled) layout height.
    const naturalH = stage.offsetHeight;
    if (!naturalH) return;
    const style = getComputedStyle(overlay);
    const availW = Math.min(
      overlay.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
      896, // 56rem cap — don't blow the poster up wall-to-wall on huge screens
    );
    const availH =
      overlay.clientHeight -
      parseFloat(style.paddingTop) -
      parseFloat(style.paddingBottom) -
      (cta?.offsetHeight ?? 0);
    this.peekHeight.set(naturalH);
    this.peekScale.set(Math.min(availW / this.peekWidth, availH / naturalH, 1));

    stage.querySelectorAll('img').forEach((im) => {
      if (!im.complete) im.addEventListener('load', () => this.measurePeek(), { once: true });
    });
  }
}

type InfoField = 'firstName' | 'lastName' | 'partnerFirstName' | 'partnerLastName' | 'weddingDate';

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
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}
