import { Component, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-about',
  imports: [TranslatePipe],
  template: `
    <section class="static-page">
      <h1>{{ 'about.title' | translate }}</h1>
      <p class="about__lead">{{ 'about.lead' | translate }}</p>
      <p>{{ 'about.body1' | translate }}</p>
      <p>{{ 'about.body2' | translate }}</p>
      <p>{{ 'about.body3' | translate }}</p>
    </section>
  `,
  // the greeting above the text: the page's one large line, in the heading colour
  styles: `
    .about__lead {
      margin-bottom: var(--space-6);
      font-family: var(--font-display);
      font-stretch: var(--stretch-display);
      font-size: var(--fs-h3);
      font-weight: var(--fw-bold);
      line-height: var(--lh-heading);
      color: var(--ink);
    }
  `,
  host: { class: 'theme-brand' },
})
export class About {
  constructor() {
    const t = inject(TranslateService);
    inject(Title).setTitle(`${t.instant('about.title')} | ${t.instant('brand.name')}`);
    // The page's own text, not the site-wide default: the paragraph that says what the
    // platform does (the first one speaks about the couple's decisions).
    inject(Meta).updateTag({ name: 'description', content: t.instant('about.body3') });
  }
}
