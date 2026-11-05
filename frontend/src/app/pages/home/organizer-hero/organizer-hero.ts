import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, effect, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * "როგორ ვაკონტროლო ყველაფერი?" — the personal-organizer block of the home page: copy
 * on the left, a tilted phone on the right playing a looping clip of the real planning tool
 * (public/media/organizer.mp4, made in video/). The server renders the poster. The browser
 * fetches the clip when the block nears the screen and pauses it once the block has left.
 * Under reduced motion, or if autoplay is refused, the poster simply stays.
 */
@Component({
  selector: 'app-organizer-hero',
  imports: [RouterLink, TranslatePipe],
  templateUrl: './organizer-hero.html',
  styleUrl: './organizer-hero.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizerHero {
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
