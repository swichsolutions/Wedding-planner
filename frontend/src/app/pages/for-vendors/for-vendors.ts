import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-for-vendors',
  imports: [RouterLink, TranslatePipe],
  templateUrl: './for-vendors.html',
  styleUrl: './for-vendors.scss',
})
export class ForVendors {
  protected readonly steps = [
    { n: 1, title: 'forVendors.step1Title', body: 'forVendors.step1Body' },
    { n: 2, title: 'forVendors.step2Title', body: 'forVendors.step2Body' },
    { n: 3, title: 'forVendors.step3Title', body: 'forVendors.step3Body' },
  ];

  constructor() {
    const t = inject(TranslateService);
    inject(Title).setTitle(`${t.instant('forVendors.title')} | ${t.instant('brand.name')}`);
    inject(Meta).updateTag({ name: 'description', content: t.instant('forVendors.subtitle') });
  }
}
