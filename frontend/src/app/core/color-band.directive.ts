import { DestroyRef, Directive, ElementRef, afterNextRender, inject, input } from '@angular/core';

/**
 * Scroll-scrubbed colour band, as on zola.com's home page: ONE wrapper around a run
 * of full-screen sections, painted with ONE colour that follows the scroll. Each
 * section holds its own colour while it fills the screen; the colour blends into the
 * next one only while the seam between two sections sweeps through the middle of the
 * viewport. There is no edge and no second background — the band is a single surface
 * (Zola drives the same thing with a framer-motion value over scroll progress).
 *
 * `appColorBand` takes one CSS hex colour per direct child section, in order. The
 * current colour is written to the host as `--band` (an rgb() string); the SCSS paints
 * the host with it and the sections stay transparent. Browser-only, after hydration:
 * without JS the band keeps the first colour from its CSS fallback.
 */
@Directive({ selector: '[appColorBand]' })
export class ColorBand {
  readonly colors = input.required<string[]>({ alias: 'appColorBand' });

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      const host = this.el.nativeElement;
      const rgb = this.colors().map(parseHex);
      const sections = Array.from(host.children) as HTMLElement[];
      if (rgb.length < 2 || sections.length < 2) return;

      // the blend runs while the seam travels from 75% down the viewport to 25%
      const FADE_START = 0.75;
      const FADE_END = 0.25;
      const smooth = (t: number) => t * t * (3 - 2 * t);

      let raf = 0;
      let last = '';

      const paint = () => {
        raf = 0;
        const vh = window.innerHeight || 1;
        let [r, g, b] = rgb[0];
        for (let i = 1; i < Math.min(rgb.length, sections.length); i++) {
          const seam = sections[i].getBoundingClientRect().top / vh; // 1 = bottom edge, 0 = top
          const t = smooth(Math.min(1, Math.max(0, (FADE_START - seam) / (FADE_START - FADE_END))));
          if (t <= 0) break;
          const [r2, g2, b2] = rgb[i];
          r += (r2 - r) * t;
          g += (g2 - g) * t;
          b += (b2 - b) * t;
        }
        const next = `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`;
        if (next !== last) {
          last = next;
          host.style.setProperty('--band', next);
        }
      };
      const schedule = () => {
        if (!raf) raf = requestAnimationFrame(paint);
      };

      paint();
      window.addEventListener('scroll', schedule, { passive: true });
      window.addEventListener('resize', schedule);
      this.destroyRef.onDestroy(() => {
        window.removeEventListener('scroll', schedule);
        window.removeEventListener('resize', schedule);
        if (raf) cancelAnimationFrame(raf);
      });
    });
  }
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
