import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink, TranslatePipe],
  template: `
    <section class="static-page static-page--center">
      <h1>{{ 'notFound.title' | translate }}</h1>
      <p>{{ 'notFound.body' | translate }}</p>
      <a class="btn btn--primary" routerLink="/">{{ 'notFound.home' | translate }}</a>
    </section>
  `,
})
export class NotFound {
  constructor() {
    const t = inject(TranslateService);
    inject(Title).setTitle(`${t.instant('notFound.title')} | ${t.instant('brand.name')}`);
    // Keep soft-404 pages out of the index.
    inject(Meta).updateTag({ name: 'robots', content: 'noindex' });
  }
}
