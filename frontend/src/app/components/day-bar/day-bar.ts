import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, signal, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { DAY_SCHEDULES, iconFor, local, minutesOf, phaseOf, phaseStarts } from '../../core/day-schedules';
import { LanguageService } from '../../i18n/language.service';
import { DayIcon } from '../day-icon/day-icon';
import { spreadApart } from './spread-apart';

/** The least space between two pins, in px. */
const PIN_SPACE = 8;

/**
 * The day as a picture: a time axis from the first moment to the last, coloured by phase, with
 * the big moments (the start of each phase, the first dance, the end) sitting at their real
 * times as icons. Hour ticks under the axis give the scale. Nothing here needs reading first.
 * Where the screen is too narrow for that (phones), close pins move apart just enough not to
 * overlap; each keeps its own time as its label.
 */
@Component({
  selector: 'app-day-bar',
  imports: [TranslatePipe, DayIcon],
  templateUrl: './day-bar.html',
  styleUrl: './day-bar.scss',
})
export class DayBar {
  private readonly lang = inject(LanguageService);
  private readonly figure = viewChild.required<ElementRef<HTMLElement>>('figure');

  /** Which example day to draw. */
  readonly scenario = input.required<string>();

  protected readonly day = computed(() => {
    const lang = this.lang.current();
    const s = DAY_SCHEDULES.find((x) => x.key === this.scenario()) ?? DAY_SCHEDULES[0];
    const rows = s.rows;
    const first = minutesOf(rows[0].time);
    const last = minutesOf(rows[rows.length - 1].time, first);
    const span = Math.max(1, last - first);
    const pct = (time: string) => ((minutesOf(time, first) - first) / span) * 100;

    const starts = phaseStarts(s.key);
    const segments = starts.map((row, i) => {
      const from = pct(rows[row].time);
      const to = i + 1 < starts.length ? pct(rows[starts[i + 1]].time) : 100;
      return { phase: phaseOf(s.key, row), left: from, width: to - from };
    });

    // hour ticks; a label on every other hour, every hour where there's room (CSS)
    const ticks: { left: number; label: string; odd: boolean }[] = [];
    for (let h = Math.ceil(first / 60); h * 60 <= last; h++) {
      ticks.push({ left: ((h * 60 - first) / span) * 100, label: `${(h % 24).toString().padStart(2, '0')}:00`, odd: h % 2 === 1 });
    }

    // the key moments: each phase's first row, the first dance, the end
    const picked = new Set<number>([...starts, rows.length - 1]);
    const party = starts[starts.length - 1];
    if (party + 1 < rows.length - 1) picked.add(party + 1);
    const marks = [...picked].sort((a, b) => a - b).map((i, n) => ({
      time: rows[i].time,
      left: pct(rows[i].time),
      icon: iconFor(local(rows[i].activity, 'ka')),
      activity: local(rows[i].activity, lang),
      phase: phaseOf(s.key, i),
      below: n % 2 === 1, // labels alternate above / below so neighbours don't collide
    }));

    return { key: s.key, segments, ticks, marks, phases: segments.map((g) => g.phase) };
  });

  /** How far apart pins must sit, as a share of the axis: one pin and a little space. */
  private readonly pinGap = signal(0);
  /** Where the pins sit, in %: their real times, unless that would make them overlap. */
  protected readonly pinLeft = computed(() => spreadApart(this.day().marks.map((m) => m.left), this.pinGap()));

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const figure = this.figure().nativeElement;
      const axis = figure.querySelector<HTMLElement>('.db__axis');
      const pin = figure.querySelector<HTMLElement>('.db__pin');
      if (!axis || !pin) return;
      const measure = () => {
        // not laid out (a hidden tab): nothing to work from until it shows
        if (axis.offsetWidth) this.pinGap.set(((pin.offsetWidth + PIN_SPACE) / axis.offsetWidth) * 100);
      };
      measure();
      if (!('ResizeObserver' in window)) return;
      const ro = new ResizeObserver(measure);
      ro.observe(axis);
      destroyRef.onDestroy(() => ro.disconnect());
    });
  }
}
