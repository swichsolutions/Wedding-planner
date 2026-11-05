import { Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { DAY_SCHEDULES, SCENARIO_ICON, local, minutesOf, phaseOf, phaseStarts } from '../../core/day-schedules';
import { LanguageService } from '../../i18n/language.service';
import { DayIcon } from '../day-icon/day-icon';

/**
 * The scenario picker: three cards, one per example day — an icon, the name, the day's span and
 * a small bar showing how the day divides into its phases. The chosen one is marked.
 */
@Component({
  selector: 'app-day-scenarios',
  imports: [TranslatePipe, DayIcon],
  templateUrl: './day-scenarios.html',
  styleUrl: './day-scenarios.scss',
})
export class DayScenarios {
  private readonly lang = inject(LanguageService);

  /** The chosen scenario's key. */
  readonly active = input.required<string>();
  readonly pick = output<string>();

  protected readonly cards = computed(() => {
    const lang = this.lang.current();
    return DAY_SCHEDULES.map((s) => {
      const first = minutesOf(s.rows[0].time);
      const last = minutesOf(s.rows[s.rows.length - 1].time, first);
      const starts = phaseStarts(s.key);
      const segments = starts.map((row, i) => {
        const from = minutesOf(s.rows[row].time, first);
        const to = i + 1 < starts.length ? minutesOf(s.rows[starts[i + 1]].time, first) : last;
        return { phase: phaseOf(s.key, row), width: ((to - from) / (last - first)) * 100 };
      });
      return {
        key: s.key,
        icon: SCENARIO_ICON[s.key] ?? 'dot',
        title: local(s.title, lang),
        first: s.rows[0].time,
        last: s.rows[s.rows.length - 1].time,
        hours: Math.round((last - first) / 60),
        count: s.rows.length,
        segments,
      };
    });
  });
}
