import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';

/**
 * A silent looping product clip (made in video/) filling its parent, which must be positioned.
 * Decorative: the text beside it says the same. The server renders the poster. The browser fetches
 * the clip when it nears the screen and pauses it once it has left. Under reduced motion, or if
 * autoplay is refused, the poster simply stays.
 */
@Component({
  selector: 'app-clip-video',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <img class="media" [src]="poster()" alt="" width="692" height="1536" loading="lazy" fetchpriority="low" />
    @if (useVideo()) {
      <!-- [muted] as a property: the attribute alone doesn't mute a video made by script -->
      <video #video class="media film" [class.is-on]="playing()" [muted]="true" loop playsinline preload="auto"
        disablepictureinpicture (playing)="playing.set(true)">
        <source [src]="src()" type="video/mp4" />
      </video>
    }
  `,
  styles: `
    :host {
      position: absolute;
      inset: 0;
      display: block;
    }

    .media {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .film {
      opacity: 0;
      transition: opacity 400ms ease;

      &.is-on {
        opacity: 1;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .film {
        transition: none;
      }
    }
  `,
})
export class ClipVideo {
  readonly src = input.required<string>();
  readonly poster = input.required<string>();

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');

  protected readonly useVideo = signal(false);
  /** The clip has started: fade it in over the poster. */
  protected readonly playing = signal(false);
  private readonly near = signal(false);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (!('IntersectionObserver' in window)) {
        this.near.set(true);
        this.useVideo.set(true);
        return;
      }
      const io = new IntersectionObserver(
        (entries) => {
          const near = entries.some((e) => e.isIntersecting);
          this.near.set(near);
          if (near) this.useVideo.set(true);
        },
        { rootMargin: '300px 0px' },
      );
      io.observe(this.el.nativeElement);
      destroyRef.onDestroy(() => io.disconnect());
    });

    effect(() => {
      const video = this.video()?.nativeElement;
      if (!video) return;
      if (!this.near()) {
        video.pause();
        return;
      }
      // only muted video may autoplay
      video.muted = true;
      video.defaultMuted = true;
      video.play().catch(() => {});
    });
  }
}
