import { Component, inject } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { pageTitle } from '../../core/page-title';
import { InquiryForm } from './inquiry-form';

@Component({
  selector: 'app-contact-page',
  imports: [TranslatePipe, InquiryForm],
  template: `
    <!-- static-page--fit: on wide screens the page (text, address, form) fits one screen -->
    <section class="static-page static-page--fit">
      <h1>{{ 'contactPage.title' | translate }}</h1>
      <p>{{ 'contactPage.body' | translate }}</p>
      <p>
        {{ 'contactPage.emailLabel' | translate }}:
        <a [href]="'mailto:' + ('contactPage.email' | translate)">{{ 'contactPage.email' | translate }}</a>
      </p>
      <!-- the inquiry form (2026-11-12), in the text column under the address -->
      <app-inquiry-form />
    </section>
  `,
  host: { class: 'theme-brand' },
})
export class ContactPage {
  constructor() {
    const t = inject(TranslateService);
    pageTitle('contactPage.title');
    inject(Meta).updateTag({ name: 'description', content: t.instant('contactPage.body') });
  }
}
