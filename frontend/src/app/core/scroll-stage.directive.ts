import { DestroyRef, Directive, ElementRef, afterNextRender, inject, output } from '@angular/core';

/**
 * The landing page's opening stage (hero → "where do I start?"): on the first scroll the
 * hero photo shrinks into the box in its middle and the second section appears around it.
 * The SCSS does the moving, with plain transitions; this directive only says which state
 * is on and supplies the one number CSS cannot work out:
 *
 * - `is-run` on the host once the page has been scrolled a little (off again at the very top,
 *   with hysteresis so it cannot flicker), and the `ran` output with the same value.
 * - `is-staged` on the host while the window is wide and tall enough for the pinned version
 *   (see home.scss), and `is-ready` a frame later, which is when the SCSS turns its
 *   transitions on. Below that size, and without JS, the host stays two ordinary blocks.
 * - `--card-scale` on the host: how far the photo may zoom out while it shrinks. It is the
 *   smallest scale at which the screen-sized photo, scaled about its centre, still covers
 *   the card it shrinks into, so the card shows as much of the picture as it can (the whole
 *   arch) instead of a full-size crop of its middle. The card's size is read from an element
 *   marked `data-stage-probe`, which the SCSS sizes like the card.
 *
 * Inside the host, mark what belongs to each state with `data-stage="rest"` / `"run"`. When
 * keyboard focus lands on something of the state that is not showing, the page scrolls to
 * the state that shows it, so focus is never on an invisible control.
 *
 * Browser-only, after hydration. Reduced motion needs nothing special: the states still
 * switch, the global reduced-motion rule makes the transitions instant.
 */
@Directive({ selector: '[appScrollStage]' })
export class ScrollStage {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  /** True once the stage has run (the first scroll), false again at the top of the page. */
  readonly ran = output<boolean>();

  constructor() {
    afterNextRender(() => {
      const host = this.el.nativeElement;
      const probe = host.querySelector<HTMLElement>('[data-stage-probe]');
      // the pinned version needs room for the heading, the card and the step pills
      const roomy = window.matchMedia('(min-width: 1024px) and (min-height: 600px)');

      const TRIGGER_DOWN = 16; // px scrolled: run
      const TRIGGER_UP = 4; // px scrolled: back to rest (hysteresis, no flicker)
      const RUN_AT = 24; // where to scroll to show the run state (past TRIGGER_DOWN)

      let run: boolean | null = null;
      const set = (next: boolean) => {
        if (next === run) return;
        run = next;
        host.classList.toggle('is-run', next);
        this.ran.emit(next);
      };

      const onScroll = () => {
        const y = window.scrollY;
        if (y > TRIGGER_DOWN) set(true);
        else if (y < TRIGGER_UP) set(false);
      };

      const measure = () => {
        const W = host.clientWidth;
        const H = window.innerHeight;
        if (!probe || !W || !H || !probe.offsetWidth) return;
        // + 0.015: a hair larger than exact, so rounding never leaves a gap at the card's edge
        const scale = Math.min(1, Math.max(probe.offsetWidth / W, probe.offsetHeight / H) + 0.015);
        host.style.setProperty('--card-scale', scale.toFixed(4));
      };

      /** Staged or not, by the window's size. `is-ready` follows a frame later and is what
       * switches the transitions on: laying the stage out (at page load, or when a window
       * grows past the breakpoint) must not itself be animated. */
      let readyFrame = 0;
      const sync = () => {
        cancelAnimationFrame(readyFrame);
        host.classList.remove('is-ready');
        host.classList.toggle('is-staged', roomy.matches);
        measure();
        if (!roomy.matches) return;
        readyFrame = requestAnimationFrame(() => {
          readyFrame = requestAnimationFrame(() => host.classList.add('is-ready'));
        });
      };

      /** Focus on a control of the hidden state: bring that state on (pinned version only;
       * stacked, everything is visible and the browser scrolls to the focus itself). */
      const onFocusIn = (e: FocusEvent) => {
        if (!roomy.matches) return;
        const state = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-stage]')?.dataset['stage'];
        if (state === 'run' && !run) window.scrollTo({ top: RUN_AT });
        else if (state === 'rest' && run && window.scrollY <= window.innerHeight) window.scrollTo({ top: 0 });
      };

      sync();
      // a page opened mid-scroll (refresh, back button) starts in the run state
      set(window.scrollY > TRIGGER_DOWN);

      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', measure);
      roomy.addEventListener('change', sync);
      host.addEventListener('focusin', onFocusIn);
      this.destroyRef.onDestroy(() => {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', measure);
        roomy.removeEventListener('change', sync);
        host.removeEventListener('focusin', onFocusIn);
        cancelAnimationFrame(readyFrame);
      });
    });
  }
}
