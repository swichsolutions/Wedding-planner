import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

interface DemoTask {
  id: number; // i18n key: home.organize.tasks.t<id>.text
  done: boolean;
}

/**
 * "როგორ ვაკონტროლო ყველაფერი?" — the personal-organizer block of the home page: copy
 * on the left, a tilted phone on the right running a small demo of the plan (progress
 * card + task list). Built from Beka's "wedding-planner-hero" sketch.
 *
 * The demo plays once the block is in view: three open tasks get highlighted and
 * ticked one after another while the progress counts 38 → 50, then it rests and
 * replays. Leaving the viewport stops the timers. Under reduced motion the finished
 * state is shown and nothing moves. All browser-only, after hydration: the server
 * renders the initial state.
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
  private readonly destroyRef = inject(DestroyRef);

  /** Seven sample tasks; the first two start done, the demo ticks 3–5. */
  private readonly initialTasks: DemoTask[] = [1, 2, 3, 4, 5, 6, 7].map((id) => ({ id, done: id <= 2 }));
  private readonly START = 38;
  private readonly STEP = 4; // progress per ticked task → ends at 50
  private readonly DEMO_IDS = [3, 4, 5];

  protected readonly daysUntilWedding = 125;
  protected readonly tasks = signal<DemoTask[]>(this.initialTasks);
  protected readonly progress = signal(this.START);
  protected readonly activeId = signal<number | null>(null);
  protected readonly doneCount = computed(() => this.tasks().filter((t) => t.done).length);

  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private visible = false;

  constructor() {
    afterNextRender(() => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.showFinalState();
        return;
      }
      if (!('IntersectionObserver' in window)) {
        this.visible = true;
        this.play();
        return;
      }
      const io = new IntersectionObserver(
        (entries) => {
          const inView = entries[0]?.isIntersecting ?? false;
          if (inView && !this.visible) {
            this.visible = true;
            this.play();
          } else if (!inView && this.visible) {
            this.visible = false;
            this.cancelTimers();
            this.activeId.set(null);
          }
        },
        { threshold: 0.2 },
      );
      io.observe(this.el.nativeElement);
      this.destroyRef.onDestroy(() => {
        io.disconnect();
        this.cancelTimers();
      });
    });
  }

  private play(): void {
    this.cancelTimers();
    this.tasks.set(this.initialTasks);
    this.progress.set(this.START);
    this.activeId.set(null);
    this.schedule(() => this.step(0), 750);
  }

  private step(i: number): void {
    if (!this.visible) return;
    if (i >= this.DEMO_IDS.length) {
      this.schedule(() => this.play(), 3600); // rest, then replay
      return;
    }
    const id = this.DEMO_IDS[i];
    this.activeId.set(id);
    this.schedule(() => {
      if (!this.visible) return;
      this.tasks.update((ts) => ts.map((t) => (t.id === id ? { ...t, done: true } : t)));
      this.activeId.set(null);
      // count up in four quick ticks, in time with the tick mark
      const from = this.START + this.STEP * i;
      for (let k = 1; k <= this.STEP; k++) this.schedule(() => this.progress.set(from + k), k * 90);
      this.schedule(() => this.step(i + 1), 1050);
    }, 1050);
  }

  private showFinalState(): void {
    this.cancelTimers();
    this.tasks.set(this.initialTasks.map((t) => (t.id <= 5 ? { ...t, done: true } : t)));
    this.progress.set(this.START + this.STEP * this.DEMO_IDS.length);
    this.activeId.set(null);
  }

  private schedule(fn: () => void, ms: number): void {
    const h = setTimeout(() => {
      this.timers.delete(h);
      fn();
    }, ms);
    this.timers.add(h);
  }

  private cancelTimers(): void {
    this.timers.forEach((h) => clearTimeout(h));
    this.timers.clear();
  }
}
