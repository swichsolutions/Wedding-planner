import { Component, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-about',
  imports: [TranslatePipe],
  template: `
    <section class="static-page">
      <h1>{{ 'about.title' | translate }}</h1>
      <p>{{ 'about.body1' | translate }}</p>
      <p>{{ 'about.body2' | translate }}</p>
      <p>{{ 'about.body3' | translate }}</p>
    </section>
  `,
  host: { class: 'theme-brand' },
})
export class About {
  constructor() {
    const t = inject(TranslateService);
    inject(Title).setTitle(`${t.instant('about.title')} | ${t.instant('brand.name')}`);
    // The page's own first paragraph, not the site-wide default.
    inject(Meta).updateTag({ name: 'description', content: t.instant('about.body1') });
  }
}
