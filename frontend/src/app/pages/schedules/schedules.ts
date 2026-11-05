import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { map } from 'rxjs';

import { DayBar } from '../../components/day-bar/day-bar';
import { DayIcon } from '../../components/day-icon/day-icon';
import { DayScenarios } from '../../components/day-scenarios/day-scenarios';
import { AuthService } from '../../core/auth.service';
import { DAY_SCHEDULES, iconFor, local, phaseOf } from '../../core/day-schedules';
import { LanguageService } from '../../i18n/language.service';

/**
 * „დღის განრიგები“ (/schedules, PROPOSALS.md P11; rebuilt 2026-11-03 on Beka's feedback that it
 * needed reading to make sense): three steps — pick the kind of day from picture cards, see
 * that day drawn on a time axis with its big moments, then the full list for the detail.
 * `?s=<key>` deep-links a scenario. „გამოიყენე ეს განრიგი“ starts a couple's own wedding day
 * from it (B2).
 */
@Component({
  selector: 'app-schedules',
  imports: [RouterLink, TranslatePipe, DayScenarios, DayBar, DayIcon],
  templateUrl: './schedules.html',
  styleUrl: './schedules.scss',
  host: { class: 'theme-brand' },
})
export class Schedules {
  private readonly lang = inject(LanguageService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly auth = inject(AuthService);

  /** The scenario in the URL (?s=), if it names one. */
  private readonly param = toSignal(this.route.queryParamMap.pipe(map((p) => p.get('s'))), { initialValue: null });
  private readonly chosen = signal<string | null>(null);

  protected readonly activeKey = computed(() => {
    const k = this.chosen() ?? this.param();
    return DAY_SCHEDULES.some((s) => s.key === k) ? (k as string) : DAY_SCHEDULES[0].key;
  });

  protected readonly active = computed(() => {
    const lang = this.lang.current();
    const s = DAY_SCHEDULES.find((x) => x.key === this.activeKey()) ?? DAY_SCHEDULES[0];
    return {
      key: s.key,
      title: local(s.title, lang),
      summary: local(s.summary, lang),
      note: local(s.note, lang),
      rows: s.rows.map((r, i) => ({
        time: r.time,
        activity: local(r.activity, lang),
        note: local(r.note, lang),
        who: local(r.who, lang),
        phase: phaseOf(s.key, i),
        icon: iconFor(local(r.activity, 'ka')),
      })),
    };
  });

  constructor() {
    const t = inject(TranslateService);
    const lang = this.lang.current();
    inject(Title).setTitle(`${t.instant('schedules.title')} | ${t.instant('brand.name')}`);
    // The description names the actual examples, so it changes when they do.
    const names = DAY_SCHEDULES.map((s) => local(s.title, lang)).join('; ');
    inject(Meta).updateTag({ name: 'description', content: t.instant('schedules.meta', { names }) });
  }

  protected pick(key: string): void {
    this.chosen.set(key);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { s: key }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  /**
   * „გამოიყენე ეს განრიგი“ (guide §3): a couple goes to their wedding day, which takes the example
   * (?use=); anyone signed out signs up (or in) first and lands there with the choice kept.
   */
  protected use(): void {
    const target = `/planning/day?use=${encodeURIComponent(this.activeKey())}`;
    if (this.auth.isCouple()) void this.router.navigateByUrl(target);
    else void this.router.navigate(['/signup'], { queryParams: { returnUrl: target } });
  }
}
