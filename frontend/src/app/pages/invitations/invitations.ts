import { Component, DOCUMENT, DestroyRef, computed, inject, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../core/auth.service';
import { img } from '../../core/catalog';
import { breadcrumbList, removeJsonLd, setJsonLd, webPage } from '../../core/structured-data';
import { EMPTY_INVITE_EXTRAS, PublicSite, WEDDING_TEMPLATES } from '../../core/website.service';
import { ClipVideo } from '../../components/clip-video/clip-video';
import { LanguageService } from '../../i18n/language.service';
import { RsvpForm } from '../../components/rsvp-form/rsvp-form';
import { WeddingSite as WeddingSiteView } from '../../components/wedding-site/wedding-site';

const JSON_LD_ID = 'invitations-jsonld';

/**
 * „მოსაწვევები“ (/invitations, BUILD-PLAN B6, P11): a clip of an invitation being made beside what
 * it does, every design next to a finished example in a phone (picking one redraws it), the steps,
 * and „შექმენი მოსაწვევი“.
 */
@Component({
  selector: 'app-invitations',
  imports: [RouterLink, TranslatePipe, WeddingSiteView, RsvpForm, ClipVideo],
  templateUrl: './invitations.html',
  styleUrl: './invitations.scss',
  host: { class: 'theme-brand' },
})
export class Invitations {
  private readonly auth = inject(AuthService);

  protected readonly templates = WEDDING_TEMPLATES;
  protected readonly shown = signal<string>('glow');
  protected readonly steps = ['design', 'info', 'places', 'details', 'rsvp', 'preview', 'share'] as const;
  protected readonly features = ['rsvp', 'guests', 'qr', 'maps', 'phone', 'free'] as const;

  /** Couples go straight to their invitation; everyone else signs up first and lands there. */
  protected readonly cta = computed(() =>
    this.auth.isCouple()
      ? { link: '/planning/invitation', query: null }
      : { link: '/signup', query: { returnUrl: '/planning/invitation' } },
  );

  /** A finished example: what guests see on the general link. */
  private readonly exampleKa: PublicSite = {
    ...EMPTY_INVITE_EXTRAS,
    templateKey: 'glow',
    firstName: 'ნინო',
    partnerFirstName: 'გიორგი',
    weddingDate: `${new Date().getFullYear() + 1}-06-14`,
    startTime: '16:00',
    place: 'თბილისი',
    message: null,
    photoUrl: img('photo-1606800052052-a08af7148866', 900),
    photoFocusY: 35,
    ceremonyName: 'სამების საკათედრო ტაძარი',
    ceremonyAddress: 'თბილისი, სამების ქუჩა',
    ceremonyTime: '16:00',
    receptionName: 'რესტორანი „ბაღი“',
    receptionAddress: 'თბილისი, წყნეთის გზატკეცილი',
    receptionTime: '18:30',
    schedule: [
      { time: '16:00', text: 'ჯვრისწერა' },
      { time: '18:30', text: 'სტუმრების მიღება' },
      { time: '19:30', text: 'ვახშამი და სადღეგრძელოები' },
      { time: '22:00', text: 'ტორტი და ცეკვა' },
    ],
    dressCode: 'ღია ფერები, ელეგანტური სტილი.',
    rsvpEnabled: true,
    rsvpDeadline: `${new Date().getFullYear() + 1}-05-15`,
    rsvpOpen: true,
  };

  private readonly sampleKa = {
    ...EMPTY_INVITE_EXTRAS,
    firstName: 'ნინო',
    partnerFirstName: 'გიორგი',
    weddingDate: `${new Date().getFullYear() + 1}-06-14`,
    place: 'თბილისი',
    message: null,
    photoUrl: null,
  };

  private readonly lang = inject(LanguageService);
  private readonly exampleEn: PublicSite = {
    ...this.exampleKa,
    firstName: 'Nino',
    partnerFirstName: 'Giorgi',
    place: 'Tbilisi',
    ceremonyName: 'Sameba Cathedral',
    ceremonyAddress: 'Tbilisi, Sameba Street',
    receptionName: 'Baghi Restaurant',
    receptionAddress: 'Tbilisi, Tskneti Highway',
    schedule: [
      { time: '16:00', text: 'Wedding ceremony' },
      { time: '18:30', text: 'Reception' },
      { time: '19:30', text: 'Dinner and toasts' },
      { time: '22:00', text: 'Cake and dancing' },
    ],
    dressCode: 'Light colours, elegant style.',
  };
  private readonly sampleEn = { ...this.sampleKa, firstName: 'Nino', partnerFirstName: 'Giorgi', place: 'Tbilisi' };
  protected readonly example = computed(() => (this.lang.current() === 'en' ? this.exampleEn : this.exampleKa));
  protected readonly sample = computed(() => (this.lang.current() === 'en' ? this.sampleEn : this.sampleKa));

  constructor() {
    const t = inject(TranslateService);
    // its own title for the search it answers (SEO round, 2026-11-13); the heading stays
    inject(Title).setTitle(`${t.instant('invitationsPage.seoTitle')} | ${t.instant('brand.name')}`);
    const description = t.instant('invitationsPage.meta', { n: WEDDING_TEMPLATES.length });
    inject(Meta).updateTag({ name: 'description', content: description });
    // what the page is and its visible trail („დაგეგმე ქორწილი“ is the home page)
    const doc = inject(DOCUMENT);
    const name = t.instant('invitationsPage.title');
    setJsonLd(doc, JSON_LD_ID, [
      webPage('WebPage', { name, description, path: '/invitations', lang: this.lang.current() }),
      breadcrumbList([
        { name: t.instant('nav.g.plan.title'), path: '/' },
        { name, path: '/invitations' },
      ]),
    ]);
    inject(DestroyRef).onDestroy(() => removeJsonLd(doc, JSON_LD_ID));
  }

  protected show(t: string): void {
    this.shown.set(t);
    document.querySelector('.iv-phone')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}
