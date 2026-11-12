import { ChangeDetectionStrategy, Component, DOCUMENT, DestroyRef, ElementRef, afterNextRender, inject, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CarouselArrow } from '../../../components/carousel-arrow/carousel-arrow';

/**
 * "ნამდვილად დამეხმარება?" — the doubts chapter of the home page, after Revolut's
 * Bills page: the promise on the left, a carousel of question cards on the right that
 * runs off the edge of the screen. The active card is full size; the next one sits
 * beside it at 90%, the one after at 90% and half faded, the previous one shrinks away.
 * The carousel advances on its own; tapping the active card flips it to its answer
 * (and holds the carousel still), tapping another card brings that one forward.
 *
 * Every answer is in the server-rendered HTML (on the card backs), so the questions
 * stay crawlable. Auto-advance runs only in view, never under reduced motion, and
 * pauses while the pointer is over the cards, keyboard focus is on them, or a card is turned.
 */
@Component({
  selector: 'app-trust-faq',
  imports: [TranslatePipe, CarouselArrow],
  templateUrl: './trust-faq.html',
  styleUrl: './trust-faq.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrustFaq {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  /** i18n keys: home.trust.faq.q<n> / a<n> */
  protected readonly questions = ['1', '2', '3', '4', '5', '6'];
  protected readonly active = signal(0);
  protected readonly flipped = signal<number | null>(null);
  protected readonly hover = signal(false);
  /** Keyboard focus is on a card or the ring. It holds the carousel like the pointer does:
   * otherwise the focused card moves away and becomes hidden from screen readers. */
  protected readonly focus = signal(false);

  private timer = 0;
  private auto = false;
  private inView = false;
  private drag: { x: number; id: number; moved: boolean } | null = null;
  private suppressClick = false;

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.addFaqData(destroyRef);
    afterNextRender(() => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      this.auto = true;
      if (!('IntersectionObserver' in window)) {
        this.inView = true;
      } else {
        const io = new IntersectionObserver((entries) => (this.inView = entries[0]?.isIntersecting ?? false), {
          threshold: 0.35,
        });
        io.observe(this.el.nativeElement);
        destroyRef.onDestroy(() => io.disconnect());
      }
      this.start();
    });
    destroyRef.onDestroy(() => this.stop());
  }

  /** The questions as FAQPage data in the head, rendered on the server. */
  private addFaqData(destroyRef: DestroyRef): void {
    const doc = inject(DOCUMENT);
    const t = inject(TranslateService);
    const id = 'faq-json-ld';
    doc.getElementById(id)?.remove();
    const script = doc.createElement('script');
    script.id = id;
    script.type = 'application/ld+json';
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: this.questions.map((n) => ({
        '@type': 'Question',
        name: t.instant(`home.trust.faq.q${n}`),
        acceptedAnswer: { '@type': 'Answer', text: t.instant(`home.trust.faq.a${n}`) },
      })),
    }).replace(/</g, '\\u003C');
    doc.head.appendChild(script);
    destroyRef.onDestroy(() => doc.getElementById(id)?.remove());
  }

  /** Card i's place relative to the active one: -1 leaving, 0 active, 1–2 waiting, 3 parked
   * (every card further out shares the parked slot, which is the last one styled). */
  protected slot(i: number): number {
    const n = this.questions.length;
    const k = (((i - this.active()) % n) + n) % n;
    return k === n - 1 ? -1 : Math.min(k, 3);
  }

  protected go(i: number): void {
    const n = this.questions.length;
    this.active.set(((i % n) + n) % n);
    this.flipped.set(null);
    this.restart();
  }

  protected onCard(i: number): void {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    if (i === this.active()) {
      this.flipped.update((f) => (f === i ? null : i));
      this.restart();
    } else {
      this.go(i);
    }
  }

  protected onKey(e: KeyboardEvent): void {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      this.go(this.active() + (e.key === 'ArrowRight' ? 1 : -1));
    }
  }

  // swipe: a horizontal move of 40px steps the carousel; a plain tap still flips
  protected onDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    this.drag = { x: e.clientX, id: e.pointerId, moved: false };
  }

  protected onMove(e: PointerEvent): void {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) < 40) return;
    d.moved = true;
    d.x = e.clientX;
    this.go(this.active() + (dx < 0 ? 1 : -1));
  }

  protected onUp(e: PointerEvent): void {
    if (this.drag && e.pointerId === this.drag.id) {
      if (this.drag.moved) this.suppressClick = true;
      this.drag = null;
    }
  }

  /** Only focus that came from the keyboard: a mouse click leaves focus on the card or the ring
   * too, and that one click would stop the carousel until the visitor clicked somewhere else. */
  protected onFocus(e: FocusEvent): void {
    this.focus.set((e.target as HTMLElement).matches(':focus-visible'));
  }

  protected onBlur(e: FocusEvent): void {
    const stage = e.currentTarget as HTMLElement;
    if (!stage.contains(e.relatedTarget as Node | null)) this.focus.set(false);
  }

  private start(): void {
    this.stop();
    this.timer = window.setInterval(() => {
      if (!this.inView || document.hidden || this.hover() || this.focus() || this.drag || this.flipped() !== null) return;
      this.active.update((a) => (a + 1) % this.questions.length);
    }, 4000);
  }

  private stop(): void {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = 0;
  }

  /** After a manual move, give the visitor a full interval before the next step. */
  private restart(): void {
    if (this.auto) this.start();
  }
}
