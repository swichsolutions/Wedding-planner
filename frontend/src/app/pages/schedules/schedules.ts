import { Component, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DaySchedules } from '../../components/day-schedules/day-schedules';
import { DAY_SCHEDULES, local } from '../../core/day-schedules';
import { LanguageService } from '../../i18n/language.service';

/**
 * „დღის განრიგები“ (/schedules, PROPOSALS.md P11): every example day schedule as a card, the
 * full schedule in a dialog (BUILD-PLAN B2's public half). „გამოიყენე ეს განრიგი“ comes with
 * the organizer's wedding-day tool.
 */
@Component({
  selector: 'app-schedules',
  imports: [RouterLink, TranslatePipe, DaySchedules],
  templateUrl: './schedules.html',
  styleUrl: './schedules.scss',
  host: { class: 'theme-brand' },
})
export class Schedules {
  constructor() {
    const t = inject(TranslateService);
    const lang = inject(LanguageService).current();
    inject(Title).setTitle(`${t.instant('schedules.title')} | ${t.instant('brand.name')}`);
    // The description names the actual examples, so it changes when they do.
    const names = DAY_SCHEDULES.map((s) => local(s.title, lang)).join('; ');
    inject(Meta).updateTag({ name: 'description', content: t.instant('schedules.meta', { names }) });
  }
}
