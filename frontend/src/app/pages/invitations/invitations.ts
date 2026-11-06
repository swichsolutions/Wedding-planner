import { Component, computed, inject, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../core/auth.service';
import { img } from '../../core/catalog';
import { EMPTY_INVITE_EXTRAS, PublicSite, WEDDING_TEMPLATES } from '../../core/website.service';
import { ClipVideo } from '../../components/clip-video/clip-video';
import { RsvpForm } from '../../components/rsvp-form/rsvp-form';
import { WeddingSite as WeddingSiteView } from '../../components/wedding-site/wedding-site';

/**
 * „მოსაწვევები“ (/invitations, BUILD-PLAN B6, P11): what the online invitation does, a finished
 * example in a phone, every design (picking one redraws the example), the steps, and
 * „შექმენი მოსაწვევი“, with a clip of an invitation being made beside the steps.
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
  protected readonly example: PublicSite = {
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

  protected readonly sample = {
    ...EMPTY_INVITE_EXTRAS,
    firstName: 'ნინო',
    partnerFirstName: 'გიორგი',
    weddingDate: `${new Date().getFullYear() + 1}-06-14`,
    place: 'თბილისი',
    message: null,
    photoUrl: null,
  };

  constructor() {
    const t = inject(TranslateService);
    inject(Title).setTitle(`${t.instant('invitationsPage.title')} | ${t.instant('brand.name')}`);
    inject(Meta).updateTag({
      name: 'description',
      content: t.instant('invitationsPage.meta', { n: WEDDING_TEMPLATES.length }),
    });
  }

  protected show(t: string): void {
    this.shown.set(t);
    document.querySelector('.iv-phone')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}
