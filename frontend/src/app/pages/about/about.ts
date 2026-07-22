import { Component, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
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
})
export class About {
  constructor() {
    const t = inject(TranslateService);
    inject(Title).setTitle(`${t.instant('about.title')} | ${t.instant('brand.name')}`);
  }
}
