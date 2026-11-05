import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';

/**
 * A gold wedding band turning slowly (public/media/gold-ring.webm, transparent background).
 * Decorative only (aria-hidden), like the brand's gold. The server renders the still
 * (gold-ring.webp). When the ring nears the screen the browser swaps in the video, or, where it
 * can't show transparent video (Safari and every iOS browser, whose WebKit would paint a black
 * box), the same turn as an animated image (gold-ring-turn.webp). Under reduced motion the
 * still stays. Size it from the outside (width); the box is square.
 */
@Component({
  selector: 'app-gold-ring',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <img class="still" [class.is-hidden]="playing()" src="/media/gold-ring.webp" alt="" width="720" height="720"
      loading="lazy" fetchpriority="low" />
    @if (motion() === 'image') {
      <img class="film" [class.is-on]="playing()" src="/media/gold-ring-turn.webp" alt="" width="400" height="400"
        decoding="async" (load)="playing.set(true)" />
    } @else if (motion() === 'video') {
      <!-- [muted] as a property: the attribute alone doesn't mute a video made by script, and
           browsers only autoplay muted video (it stayed a still in Chrome) -->
      <video #video class="film" [class.is-on]="playing()" [muted]="true" loop playsinline preload="auto"
        disablepictureinpicture (playing)="playing.set(true)">
        <source src="/media/gold-ring.webm" type="video/webm" />
      </video>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      aspect-ratio: 1;
    }

    .still,
    .film {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }

    .still {
      object-fit: contain;
      transition: opacity 400ms ease;

      &.is-hidden {
        opacity: 0;
      }
    }

    // the video is 16:9 with the ring in the middle: cover-fit crops the empty sides
    .film {
      object-fit: cover;
      opacity: 0;
      transition: opacity 400ms ease;

      &.is-on {
        opacity: 1;
      }
    }
  `,
})
export class GoldRing {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');

  /** What replaces the still: nothing until the ring nears the screen. */
  protected readonly motion = signal<'video' | 'image' | null>(null);
  /** The video or image has started: fade it in over the still. */
  protected readonly playing = signal(false);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) return;
      const motion = GoldRing.alphaVideo() ? 'video' : 'image';
      // Up to ~3.6 MB: fetch it only when the ring comes near the screen (the home page's final
      // section is far down; page speed counts for search).
      if (!('IntersectionObserver' in window)) {
        this.motion.set(motion);
        return;
      }
      const io = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting)) return;
          io.disconnect();
          this.motion.set(motion);
        },
        { rootMargin: '300px 0px' },
      );
      io.observe(this.host.nativeElement);
      destroyRef.onDestroy(() => io.disconnect());
    });

    // Start it once the element exists: muted first (only muted video may autoplay), then play.
    // Autoplay can still be refused (data saver, battery saver): then the still simply stays.
    effect(() => {
      const video = this.video()?.nativeElement;
      if (!video) return;
      video.muted = true;
      video.defaultMuted = true;
      video.play().catch(() => {});
    });
  }

  /**
   * Transparent VP9 is certain only in Chromium (Chrome, Edge, Opera, Samsung Internet). WebKit
   * (Safari, every iOS browser, whatever its name) paints a black box; Firefox isn't reliable.
   */
  private static alphaVideo(): boolean {
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
    if (ios || !/Chrome|Chromium|Edg|OPR/.test(ua)) return false;
    return document.createElement('video').canPlayType('video/webm; codecs="vp9"') !== '';
  }
}
