import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../core/auth.service';
import { DAY_SCHEDULES } from '../../core/day-schedules';
import { schedulePath } from '../../core/schedule-addresses';
import { DayBar } from '../day-bar/day-bar';
import { DayScenarios } from '../day-scenarios/day-scenarios';

/**
 * The home chapter's version of the day schedules (Beka, 2026-11-03): the three picture cards
 * to pick a kind of day, that day drawn on a time axis, and the way to the full schedule.
 * No lists here — the chapter has to read without reading.
 */
@Component({
  selector: 'app-day-preview',
  imports: [RouterLink, TranslatePipe, DayScenarios, DayBar],
  templateUrl: './day-preview.html',
  styleUrl: './day-preview.scss',
})
export class DayPreview {
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);

  protected readonly activeKey = signal(DAY_SCHEDULES[0].key);
  /** The chosen scenario's own page, with the whole timeline. */
  protected readonly fullSchedule = computed(() => schedulePath(this.activeKey()));

  /** „გამოიყენე ეს განრიგი“: a couple's wedding day takes the example; a visitor signs up first. */
  protected use(): void {
    const target = `/planning/day?use=${encodeURIComponent(this.activeKey())}`;
    if (this.auth.isCouple()) void this.router.navigateByUrl(target);
    else void this.router.navigate(['/signup'], { queryParams: { returnUrl: target } });
  }
}
