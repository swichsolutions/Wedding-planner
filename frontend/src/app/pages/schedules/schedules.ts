import { Component, DOCUMENT, DestroyRef, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { map } from 'rxjs';

import { DayBar } from '../../components/day-bar/day-bar';
import { DayIcon } from '../../components/day-icon/day-icon';
import { DayScenarios } from '../../components/day-scenarios/day-scenarios';
import { ShareButton } from '../../components/share-button/share-button';
import { AuthService } from '../../core/auth.service';
import { DAY_SCHEDULES, iconFor, local, phaseOf } from '../../core/day-schedules';
import { SCHEDULES_PATH, scheduleBySlug, schedulePath } from '../../core/schedule-addresses';
import { Crumb, breadcrumbList, removeJsonLd, setJsonLd, webPage } from '../../core/structured-data';
import { LanguageService } from '../../i18n/language.service';

const JSON_LD_ID = 'schedules-jsonld';

/**
 * „დღის განრიგები“ (/ganrigebi; rebuilt 2026-11-03 on Beka's feedback that it
 * needed reading to make sense): three steps — pick the kind of day from picture cards, see
 * that day drawn on a time axis with its big moments, then the full list for the detail.
 * Each scenario has its own address (/ganrigebi/<slug>, since 2026-11-13; core/schedule-addresses.ts)
 * with its own title and description; /ganrigebi shows the first one. „გამოიყენე ეს განრიგი“
 * starts a couple's own wedding day from it (B2).
 */
@Component({
  selector: 'app-schedules',
  imports: [RouterLink, TranslatePipe, DayScenarios, DayBar, DayIcon, ShareButton],
  templateUrl: './schedules.html',
  styleUrl: './schedules.scss',
  host: { class: 'theme-brand' },
})
export class Schedules {
  private readonly lang = inject(LanguageService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly auth = inject(AuthService);

  /** The scenario the address names (/ganrigebi/<slug>); none on /ganrigebi. */
  private readonly slug = toSignal(this.route.paramMap.pipe(map((p) => p.get('slug'))), { requireSync: true });

  protected readonly activeKey = computed(() => {
    const k = scheduleBySlug(this.slug());
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
    const title = inject(Title);
    const meta = inject(Meta);
    const doc = inject(DOCUMENT);
    inject(DestroyRef).onDestroy(() => removeJsonLd(doc, JSON_LD_ID));
    // An effect, not once: a scenario's card opens its address without leaving the page (one
    // route for all of them).
    effect(() => {
      const lang = this.lang.current();
      const brand = t.instant('brand.name');
      const section = t.instant('schedules.title');
      const page = `${section} | ${brand}`;
      // the page's visible trail („დაგეგმე ქორწილი“ is the home page) → (one example)
      const crumbs: Crumb[] = [
        { name: t.instant('nav.g.plan.title'), path: '/' },
        { name: section, path: SCHEDULES_PATH },
      ];
      let name = section;
      let description: string;
      let path = SCHEDULES_PATH;
      if (this.slug()) {
        // One scenario's own page: its name and summary, so the three don't share a title.
        const s = this.active();
        title.setTitle(`${s.title} — ${page}`);
        description = `${s.title}: ${s.summary}`;
        name = s.title;
        path = schedulePath(s.key);
        crumbs.push({ name, path });
      } else {
        // its own title for the search it answers (SEO round, 2026-11-13); the count is the data's
        title.setTitle(`${t.instant('schedules.seoTitle', { n: DAY_SCHEDULES.length })} | ${brand}`);
        // The description names the actual examples, so it changes when they do.
        const names = DAY_SCHEDULES.map((s) => local(s.title, lang)).join('; ');
        description = t.instant('schedules.meta', { names, n: DAY_SCHEDULES.length });
      }
      meta.updateTag({ name: 'description', content: description });
      setJsonLd(doc, JSON_LD_ID, [webPage('WebPage', { name, description, path, lang }), breadcrumbList(crumbs)]);
    });
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
