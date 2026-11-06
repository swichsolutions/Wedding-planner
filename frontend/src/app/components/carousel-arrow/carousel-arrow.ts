import { Component, input, output, ElementRef, effect, viewChild } from '@angular/core';

/**
 * The carousels' "next" control (Beka, 2026-11-03): one round button in the far right corner.
 * It is drawn as the brand's gold ring, and the ring fills up while the carousel waits to move
 * on its own — so the automatic rotation is visible, and a click is an invitation rather than a
 * surprise. `tick` is whatever changes when the carousel moves (the active index): the fill
 * starts again from the top on every change. `paused` mirrors the carousel's own pause (hover,
 * a flipped card). The host carries the global `.car-arrow` positioning (and `.car-arrow--light`
 * on photos); this component draws what's inside.
 */
@Component({
  selector: 'app-car-arrow',
  templateUrl: './carousel-arrow.html',
  styleUrl: './carousel-arrow.scss',
  host: { class: 'car-arrow' },
})
export class CarouselArrow {
  /** The accessible name („შემდეგი“). */
  readonly label = input.required<string>();
  /** How long the carousel waits before moving on its own, in ms; 0 = it doesn't. */
  readonly interval = input(0);
  /** True while the carousel's own timer is paused. */
  readonly paused = input(false);
  /** Changes whenever the carousel moves (the active index): restarts the fill. */
  readonly tick = input<unknown>(0);
  private readonly fill = viewChild<ElementRef<SVGElement>>('fill');

  /** Every move starts the ring's fill again from the top. */
  private readonly restart = effect(() => {
    this.tick();
    const el = this.fill()?.nativeElement;
    for (const a of el?.getAnimations?.() ?? []) a.currentTime = 0;
  });

  readonly next = output<void>();
}
