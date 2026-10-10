import { DestroyRef, Directive, ElementRef, afterNextRender, inject } from '@angular/core';

/**
 * Scroll-triggered stage (the landing hero), Revolut-style. The hero is a plain
 * full-screen section; the FIRST small scroll triggers a timed animation that runs
 * to the end on its own (not scrubbed by scroll distance). Progress is written to
 * the host as `--p` (0…1); the SCSS does the rest (clip the photo into a card,
 * slide cards in, fade the heading). Scrolling back to the very top reverses it.
 *
 * Browser-only, after hydration. Without JS or under prefers-reduced-motion the
 * host never gets `is-staged`, and the SCSS falls back to a plain full-screen hero.
 */
@Directive({ selector: '[appScrollStage]' })
export class ScrollStage {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      const host = this.el.nativeElement;
      host.classList.add('is-staged');

      const DURATION = 950; // ms, one run of the transform
      const TRIGGER_DOWN = 16; // px scrolled: start the transform
      const TRIGGER_UP = 4; // px scrolled: reverse it (hysteresis, no flicker)
      const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

      let p = 0;
      let target = 0;
      let from = 0;
      let startedAt = 0;
      let raf = 0;

      /** How far the photo may zoom out while it shrinks into the centre card: the
       * smallest scale at which the (viewport-sized) image, scaled about the viewport
       * centre and shifted down into the card, still covers the card area. That shows
       * as much of the picture as possible (the whole arch) instead of a viewport-scale
       * crop of its middle. Measured from a side card (same size as the centre card). */
      const measure = () => {
        const card = host.querySelector<HTMLElement>('.stage__card');
        const W = host.clientWidth;
        const H = window.innerHeight;
        if (!W || !H) return;
        // phones hide the side cards (the strip replaces them) and keep the photo as a
        // full-width band, so there is nothing to zoom out for
        // the centre card is `--mid` times a side card (see home.scss), so the photo
        // must stay at least that much larger than a side card to fill it
        const mid = parseFloat(getComputedStyle(host).getPropertyValue('--mid')) || 1;
        const scale = !card || !card.offsetWidth
          ? 1
          : Math.min(1, Math.max((card.offsetWidth * mid) / W, (card.offsetHeight * mid) / H) + 0.015);
        host.style.setProperty('--card-scale', scale.toFixed(4));
        host.style.setProperty('--stage-w', `${W}px`);
        host.style.setProperty('--stage-h', `${H}px`);
      };

      const apply = () => {
        host.style.setProperty('--p', p.toFixed(4));
        // once the hero copy has faded, stop it catching clicks
        host.classList.toggle('is-past', p > 0.35);
      };

      const tick = (now: number) => {
        const t = Math.min(1, (now - startedAt) / DURATION);
        p = from + (target - from) * easeOut(t);
        apply();
        raf = t < 1 ? requestAnimationFrame(tick) : 0;
      };

      const setTarget = (next: number) => {
        if (next === target) return;
        target = next;
        from = p;
        startedAt = performance.now();
        if (!raf) raf = requestAnimationFrame(tick);
      };

      const onScroll = () => {
        const y = window.scrollY;
        if (y > TRIGGER_DOWN) setTarget(1);
        else if (y < TRIGGER_UP) setTarget(0);
      };

      // A page opened mid-scroll (refresh, back button) starts in the end state.
      if (window.scrollY > TRIGGER_DOWN) {
        p = target = 1;
      }
      measure();
      apply();

      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', measure);
      this.destroyRef.onDestroy(() => {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', measure);
        if (raf) cancelAnimationFrame(raf);
      });
    });
  }
}
