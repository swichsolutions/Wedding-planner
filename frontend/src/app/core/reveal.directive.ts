import { Directive, ElementRef, afterNextRender, inject } from '@angular/core';

/**
 * Scroll reveal. The server renders every element visible (no attribute, so no
 * hidden content for crawlers or for users without JS). In the browser, after
 * hydration, the host gets `data-reveal` and an IntersectionObserver adds
 * `is-in` once it scrolls into view. Global CSS (styles/_base.scss) handles the
 * transition and switches itself off under prefers-reduced-motion.
 */
@Directive({ selector: '[appReveal]' })
export class Reveal {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterNextRender(() => {
      const host = this.el.nativeElement;
      if (typeof IntersectionObserver === 'undefined') return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      host.setAttribute('data-reveal', '');
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              host.classList.add('is-in');
              io.disconnect();
            }
          }
        },
        { rootMargin: '0px 0px -10% 0px', threshold: 0.08 },
      );
      io.observe(host);
    });
  }
}
