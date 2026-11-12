import {
  Component,
  ElementRef,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { formatDate } from '../../core/dates';
import { LanguageService } from '../../i18n/language.service';
import { PublicSite, RsvpGuest, RsvpParty, WebsiteService } from '../../core/website.service';

/** The RSVP food options (PROPOSALS P10); allergy and other ask for the details in the text. */
const DIETS = ['vegetarian', 'vegan', 'fasting', 'kids', 'allergy', 'other'] as const;
type Diet = (typeof DIETS)[number];

interface GuestAnswer {
  attendance: 'yes' | 'no' | null;
  diet: string;
  plusOne: string;
}

/**
 * The reply on the invitation (B6). On a personal link it shows the party's own form: each guest
 * row (with its plus-one and child) coming or not, food needs, a message and the couple's own
 * question; answers go straight to the couple's guest list. On the general link it only says
 * that replies come through the personal links. Drawn in the invitation's own colours.
 */
@Component({
  selector: 'app-rsvp-form',
  imports: [TranslatePipe],
  templateUrl: './rsvp-form.html',
  styleUrl: './rsvp-form.scss',
})
export class RsvpForm {
  private readonly svc = inject(WebsiteService);
  private readonly translate = inject(TranslateService);
  private readonly lang = inject(LanguageService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly slug = input.required<string>();
  /** The party's code; null on the general link. */
  readonly code = input<string | null>(null);
  readonly site = input.required<PublicSite>();

  protected readonly diets = DIETS;
  protected readonly party = signal<RsvpParty | null>(null);
  /** loading → ready; missing when the personal link no longer works (404); failed when the
   * request didn't get through (connection, rate limit) and can be tried again. */
  protected readonly state = signal<'loading' | 'ready' | 'missing' | 'failed'>('loading');
  /** The form, or the summary of the answers already sent. */
  protected readonly editing = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly answers = signal<Record<number, GuestAnswer>>({});
  protected readonly message = signal('');
  protected readonly answer = signal('');

  protected readonly deadline = computed(() =>
    formatDate(this.party()?.deadline ?? this.site().rsvpDeadline, this.lang.current()),
  );

  /** Who this personal link is for: the family's name, or the guest's own names. */
  protected readonly partyName = computed(() => {
    const p = this.party();
    if (!p) return '';
    return p.familyName ?? p.guests.map((g) => g.name).join(', ');
  });

  constructor() {
    // Read in the browser only: the names on a personal link never go through the server
    // render, and link previews in chat apps don't count as a visit.
    let loadedFor = '';
    effect(() => {
      const code = this.code();
      const slug = this.slug();
      if (!this.isBrowser || !code || loadedFor === `${slug}/${code}`) return;
      loadedFor = `${slug}/${code}`;
      untracked(() => this.load());
    });
  }

  /** Reads the party behind the personal link; also the "try again" button. */
  protected load(): void {
    const code = this.code();
    if (!code) return;
    this.state.set('loading');
    this.svc.rsvp(this.slug(), code).subscribe({
      next: (p) => this.take(p),
      // Only a 404 means the link is dead; telling a family "this link no longer works"
      // over a dropped connection would send them to phone the couple for nothing.
      error: (err: unknown) =>
        this.state.set(err instanceof HttpErrorResponse && err.status === 404 ? 'missing' : 'failed'),
    });
  }

  private take(p: RsvpParty): void {
    this.party.set(p);
    this.answers.set(
      Object.fromEntries(
        p.guests.map((g) => [
          g.id,
          {
            attendance: g.attendance === 'pending' ? null : g.attendance,
            diet: g.dietaryNeeds ?? '',
            plusOne: '',
          } satisfies GuestAnswer,
        ]),
      ),
    );
    this.message.set(p.message ?? '');
    this.answer.set(p.answer ?? '');
    this.editing.set(!p.respondedAt && p.open);
    this.state.set('ready');
  }

  /** "გიორგი ბერიძე · ნინო · ბავშვი": the guest with whoever comes along. */
  protected people(g: RsvpGuest): string {
    const names = [g.name];
    if (g.hasPlusOne) names.push(g.plusOneName ?? this.translate.instant('rsvp.plusOne'));
    if (g.hasChild) names.push(g.childName ?? this.translate.instant('rsvp.child'));
    return names.join(' · ');
  }

  protected isGroup(g: RsvpGuest): boolean {
    return g.hasPlusOne || g.hasChild;
  }

  protected answerOf(id: number): GuestAnswer {
    return this.answers()[id] ?? { attendance: null, diet: '', plusOne: '' };
  }

  protected set(id: number, change: Partial<GuestAnswer>): void {
    this.answers.update((all) => ({ ...all, [id]: { ...this.answerOf(id), ...change } }));
    this.error.set(null);
  }

  protected onText(id: number, field: 'diet' | 'plusOne', event: Event): void {
    this.set(id, { [field]: (event.target as HTMLInputElement).value });
  }

  // ---- food quick picks (P10) ----

  private dietLabel(d: Diet): string {
    return this.translate.instant(`rsvp.diet.${d}`);
  }

  private parts(text: string): string[] {
    return text
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
  }

  protected dietOn(id: number, d: Diet): boolean {
    const label = this.dietLabel(d).toLocaleLowerCase();
    return this.parts(this.answerOf(id).diet).some((p) => p.toLocaleLowerCase().startsWith(label));
  }

  /** Plain options toggle in the text; allergy adds "allergy: " for the details; other just
   * moves to the text. */
  protected pickDiet(id: number, d: Diet): void {
    const label = this.dietLabel(d);
    let parts = this.parts(this.answerOf(id).diet);
    if (d === 'allergy') {
      if (!this.dietOn(id, d)) parts.push(`${label}: `);
    } else if (d !== 'other') {
      const on = this.dietOn(id, d);
      parts = on ? parts.filter((p) => p.toLocaleLowerCase() !== label.toLocaleLowerCase()) : [...parts, label];
    }
    const text = parts.join(', ').slice(0, 200);
    this.set(id, { diet: text });
    if (d === 'allergy' || d === 'other') {
      const input = this.host.nativeElement.querySelector<HTMLInputElement>(`#rsvp-diet-${id}`);
      if (input) {
        input.value = text;
        input.focus();
        input.setSelectionRange(text.length, text.length);
      }
    }
  }

  // ---- send ----

  protected submit(): void {
    const p = this.party();
    const slug = this.slug();
    const code = this.code();
    if (!p || !code || this.busy()) return;
    const all = this.answers();
    if (p.guests.some((g) => !all[g.id]?.attendance)) {
      this.error.set('rsvp.chooseAll');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.svc
      .answerRsvp(slug, code, {
        guests: p.guests.map((g) => {
          const a = all[g.id];
          return {
            id: g.id,
            attendance: a.attendance!,
            dietaryNeeds: a.diet.replace(/[,:\s]+$/, '').trim() || null,
            plusOneName: a.plusOne.trim() || null,
          };
        }),
        message: this.message().trim() || null,
        answer: this.answer().trim() || null,
      })
      .subscribe({
        next: (r) => {
          this.busy.set(false);
          this.take(r);
          this.editing.set(false);
        },
        error: (err: unknown) => {
          this.busy.set(false);
          const status = err instanceof HttpErrorResponse ? err.status : 0;
          if (status === 409) {
            this.party.set({ ...p, open: false });
            this.editing.set(false);
            this.error.set('rsvp.closedNow');
          } else {
            this.error.set(status === 429 ? 'rsvp.tooMany' : 'rsvp.error');
          }
        },
      });
  }

  protected edit(): void {
    this.editing.set(true);
    this.error.set(null);
  }

}
