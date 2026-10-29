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
 * (gold-ring.webp); the browser swaps in the video where it can show it: not in Safari or any
 * iOS browser (WebKit has no alpha video and would paint a black box), not under reduced
 * motion. The video is fetched only when the ring nears the screen. Size it from the outside
 * (width); the box is square.
 */
@Component({
  selector: 'app-gold-ring',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <img class="still" [class.is-hidden]="playing()" src="/media/gold-ring.webp" alt="" width="720" height="720"
      loading="lazy" fetchpriority="low" />
    @if (useVideo()) {
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

    // no video (Safari / iOS): the still floats gently instead
    @media (prefers-reduced-motion: no-preference) {
      :host(.is-still) .still {
        animation: ring-float 6s ease-in-out infinite;
      }
    }

    @keyframes ring-float {
      0%,
      100% {
        transform: translateY(0) rotate(0deg);
      }

      50% {
        transform: translateY(-4%) rotate(-3deg);
      }
    }
  `,
})
export class GoldRing {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');

  protected readonly useVideo = signal(false);
  /** The video has started: fade it in over the still. */
  protected readonly playing = signal(false);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) return;
      if (!GoldRing.alphaVideo()) {
        this.host.nativeElement.classList.add('is-still');
        return;
      }
      // The video is ~3.6 MB: fetch it only when the ring comes near the screen (the home page's
      // final section is far down; page speed counts for search).
      if (!('IntersectionObserver' in window)) {
        this.useVideo.set(true);
        return;
      }
      const io = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting)) return;
          io.disconnect();
          this.useVideo.set(true);
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
