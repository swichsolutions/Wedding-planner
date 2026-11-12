import { DestroyRef, Directive, ElementRef, afterNextRender, inject, output } from '@angular/core';

/**
 * The landing page's opening stage (hero → "where do I start?"). The host shows two sets of
 * words around one photo and one box; this directive only says which set is on:
 *
 * - `is-run` on the host once the page has been scrolled a little (off again at the very top,
 *   with hysteresis so it cannot flicker), and the `ran` output with the same value. The SCSS
 *   swaps the words with plain transitions; nothing is measured or animated from here.
 * - `is-staged` on the host while the window is wide and tall enough for the pinned version
 *   (see home.scss). Below that, and without JS, the host stays an ordinary pair of blocks.
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
      // the pinned version needs room for the box between the bar and the step pills
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

      const sync = () => host.classList.toggle('is-staged', roomy.matches);

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
      roomy.addEventListener('change', sync);
      host.addEventListener('focusin', onFocusIn);
      this.destroyRef.onDestroy(() => {
        window.removeEventListener('scroll', onScroll);
        roomy.removeEventListener('change', sync);
        host.removeEventListener('focusin', onFocusIn);
      });
    });
  }
}
