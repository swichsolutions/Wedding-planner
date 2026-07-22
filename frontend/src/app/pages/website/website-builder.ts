import { Component, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../core/auth.service';
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
  host: { '(document:keydown.escape)': 'onEscape()' },
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
  protected readonly couple = signal<CoupleProfile | null>(null);

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
  };

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

    if (this.isBrowser && this.isCouple()) {
      this.svc.get().subscribe({
        next: (s) => {
          this.site.set(s);
          this.loaded.set(true);
        },
        error: () => this.loadError.set(true),
      });
      this.coupleSvc.me().subscribe({
        next: (c) => this.couple.set(c),
        error: () => {},
      });
    }
  }

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
      ...changes,
    };
    this.site.set({ ...s, ...changes }); // optimistic — the preview updates instantly
    this.svc.update(payload).subscribe({
      next: (r) => this.site.set(r),
      error: () => {
        this.site.set(s);
        this.toast.error('website.saveError');
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

  // ---- publish ----

  protected publish(): void {
    if (this.publishBusy()) return;
    this.publishBusy.set(true);
    this.svc.publish().subscribe({
      next: (s) => {
        this.site.set(s);
        this.publishBusy.set(false);
        this.showPublished.set(true);
      },
      error: () => {
        this.publishBusy.set(false);
        this.toast.error('website.saveError');
      },
    });
  }

  protected unpublish(): void {
    if (this.publishBusy()) return;
    this.publishBusy.set(true);
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
    this.showPublished.set(false);
  }

  protected onEscape(): void {
    this.showPublished.set(false);
  }

  protected onPublishedOverlay(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closePublished();
  }
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
