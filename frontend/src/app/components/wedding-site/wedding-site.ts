import {
  Component,
  ElementRef,
  Renderer2,
  RendererStyleFlags2,
  computed,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';

import { WeddingSiteData } from '../../core/website.service';
import { LanguageService } from '../../i18n/language.service';

/** Structural layout archetypes — each theme maps to one. */
type SiteLayout =
  | 'classic'
  | 'banner'
  | 'split'
  | 'arch'
  | 'monogram'
  | 'medallion'
  | 'tapestry'
  | 'masthead'
  | 'postcard';

const TEMPLATE_LAYOUTS: Record<string, SiteLayout> = {
  glow: 'classic',
  forest: 'classic',
  seaside: 'banner',
  midnight: 'banner',
  minimal: 'split',
  vineyard: 'split',
  blush: 'arch',
  sunrise: 'arch',
  calligraphy: 'monogram',
  garnet: 'monogram',
  minankari: 'medallion',
  pardagi: 'tapestry',
  pearl: 'masthead',
  tbilisi: 'postcard',
};

/**
 * Renders a couple's wedding site in one of the catalog designs. Designs differ
 * structurally (5 layout archetypes) as well as in palette/typography. Used at
 * full size by the public /w/{slug} page and the builder's live preview, and in
 * `thumb` mode (hero only) by the design gallery.
 *
 * Theme palettes are content design (each site's own look), deliberately outside
 * the app's UI tokens — see the theme blocks in the SCSS.
 */
@Component({
  selector: 'app-wedding-site',
  imports: [TranslatePipe, NgTemplateOutlet],
  templateUrl: './wedding-site.html',
  styleUrl: './wedding-site.scss',
})
export class WeddingSite {
  private readonly lang = inject(LanguageService);
  private readonly renderer = inject(Renderer2);
  private readonly root = viewChild<ElementRef<HTMLElement>>('wsRoot');

  readonly data = input.required<WeddingSiteData>();
  readonly template = input.required<string>();
  readonly thumb = input(false);

  protected readonly layout = computed<SiteLayout>(
    () => TEMPLATE_LAYOUTS[this.template()] ?? 'classic',
  );

  constructor() {
    // Custom colors are applied imperatively. Template bindings can't do this:
    // [style.--custom-prop] is ignored, and [attr.style] gets cleared by Angular's
    // styling runtime in the browser. Renderer.setStyle with DashCase writes the
    // custom properties directly on the element (values are server-validated hex).
    effect(() => {
      const el = this.root()?.nativeElement;
      if (!el) return;
      const { inkColor, accentColor } = this.data();
      const set = (prop: string, value: string | null): void => {
        if (value) this.renderer.setStyle(el, prop, value, RendererStyleFlags2.DashCase);
        else this.renderer.removeStyle(el, prop, RendererStyleFlags2.DashCase);
      };
      set('--wsink', inkColor);
      set('--wsmuted', inkColor ? `color-mix(in srgb, ${inkColor} 65%, transparent)` : null);
      set('--wsaccent', accentColor);
    });
  }

  protected readonly nameA = computed(() => (this.data().firstName ?? '').trim());
  protected readonly nameB = computed(() => (this.data().partnerFirstName ?? '').trim());

  /** object-position for the couple's photo — keeps their chosen focal point in frame. */
  protected readonly photoPos = computed(() => {
    const d = this.data();
    return `${d.photoFocusX ?? 50}% ${d.photoFocusY ?? 50}%`;
  });

  /** Initials seal for the monogram layout, e.g. "ნ · გ". */
  protected readonly initials = computed(() => {
    const a = this.nameA().charAt(0);
    const b = this.nameB().charAt(0);
    if (a && b) return `${a} · ${b}`;
    return a || b || '♥';
  });

  protected readonly namesLine = computed(() => {
    const a = this.nameA();
    const b = this.nameB();
    if (a && b) return `${a} & ${b}`;
    return a || b || '';
  });

  protected readonly dateLine = computed(() => {
    const date = this.data().weddingDate;
    if (!date) return '';
    const parsed = new Date(date + 'T00:00:00');
    if (Number.isNaN(parsed.getTime())) return '';
    const locale = this.lang.current() === 'en' ? 'en-US' : 'ka-GE';
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(
      parsed,
    );
  });

  protected readonly daysToGo = computed<number | null>(() => {
    const date = this.data().weddingDate;
    if (!date) return null;
    const [y, m, d] = date.split('-').map(Number);
    if (!y || !m || !d) return null;
    // Anchor "today" to Georgia time (fixed UTC+4, no DST) so the SSR server (UTC)
    // and the guest's browser count the same day — local-midnight math differed for
    // ~4h around Tbilisi midnight and broke hydration.
    const tbilisiNow = new Date(Date.now() + GEORGIA_UTC_OFFSET_MS);
    const today = Date.UTC(
      tbilisiNow.getUTCFullYear(),
      tbilisiNow.getUTCMonth(),
      tbilisiNow.getUTCDate(),
    );
    const wedding = Date.UTC(y, m - 1, d);
    if (Number.isNaN(wedding)) return null;
    return Math.round((wedding - today) / 86_400_000);
  });
}

const GEORGIA_UTC_OFFSET_MS = 4 * 3_600_000;
