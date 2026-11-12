import { Component, ElementRef, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Meta, Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ConfirmService } from '../../core/confirm.service';
import { CoupleService } from '../../core/couple.service';
import { DAY_SCHEDULES, local, scheduleRows } from '../../core/day-schedules';
import { formatDate } from '../../core/dates';
import { ToastService } from '../../core/toast.service';
import { Vendor } from '../../core/vendor.models';
import { VendorService } from '../../core/vendor.service';
import { DayItem, DayItemEdit, WeddingDayService, dayTimeKey } from '../../core/wedding-day.service';
import { WishlistService } from '../../core/wishlist.service';
import { LanguageService } from '../../i18n/language.service';

/** A suggestion for "who's responsible": the couple themselves or a saved vendor (with a phone). */
interface WhoSuggestion {
  name: string;
  contact: string | null;
}

/**
 * „ქორწილის დღე“ (BUILD-PLAN B2, guide §7): the couple's own day, in time order — each activity
 * with its time, who's responsible and how to reach them. Starts from an example (/schedules →
 * „გამოიყენე ეს განრიგი“ lands here with ?use=<key>) or blank; add, edit, delete; activities at
 * the same time can be moved up or down. Shared by both partners.
 */
@Component({
  selector: 'app-wedding-day',
  imports: [NgTemplateOutlet, ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './wedding-day.html',
  styleUrl: './wedding-day.scss',
  host: { class: 'theme-brand' },
})
export class WeddingDay {
  private readonly day = inject(WeddingDayService);
  private readonly couple = inject(CoupleService);
  private readonly vendors = inject(VendorService);
  private readonly wishlist = inject(WishlistService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly lang = inject(LanguageService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly items = signal<DayItem[]>([]);
  protected readonly loaded = signal(false);
  protected readonly loadError = signal(false);
  protected readonly weddingDate = signal<string | null>(null);
  private readonly people = signal<WhoSuggestion[]>([]);
  private readonly allVendors = signal<Vendor[]>([]);
  /** The two of them, then their saved vendors (follows the wishlist as it loads). */
  protected readonly suggestions = computed<WhoSuggestion[]>(() => {
    const saved = new Set(this.wishlist.ids());
    const fromVendors = this.allVendors()
      .filter((v) => saved.has(v.id))
      .map((v) => ({ name: v.name, contact: v.phone ?? null }));
    return [...this.people(), ...fromVendors];
  });

  /** The form is open: 'new' adds, a number edits that activity. */
  protected readonly editing = signal<'new' | number | null>(null);
  protected readonly saving = signal(false);
  protected readonly showExamples = signal(false);

  protected readonly form = this.fb.group({
    time: [''],
    activity: ['', [Validators.required, Validators.maxLength(200)]],
    note: ['', [Validators.maxLength(500)]],
    who: ['', [Validators.maxLength(120)]],
    contact: ['', [Validators.maxLength(120)]],
  });

  protected readonly examples = computed(() => {
    const l = this.lang.current();
    return DAY_SCHEDULES.map((s) => ({
      key: s.key,
      title: local(s.title, l),
      summary: local(s.summary, l),
      count: s.rows.length,
      span: `${s.rows[0].time}–${s.rows[s.rows.length - 1].time}`,
    }));
  });

  constructor() {
    const t = inject(TranslateService);
    inject(Title).setTitle(`${t.instant('day.title')} | ${t.instant('brand.name')}`);
    inject(Meta).updateTag({ name: 'robots', content: 'noindex' });
    if (isPlatformBrowser(inject(PLATFORM_ID))) this.load();
  }

  protected retry(): void {
    this.loadError.set(false);
    this.load();
  }

  private load(): void {
    this.day.list().subscribe({
      next: (items) => {
        this.items.set(items);
        this.loaded.set(true);
        const use = this.route.snapshot.queryParamMap.get('use');
        if (use) void this.useExample(use, true);
      },
      error: () => this.loadError.set(true),
    });
    // The date for the heading, and "who" suggestions: the two of them and their saved vendors.
    forkJoin({
      plan: this.couple.me().pipe(catchError(() => of(null))),
      vendors: this.vendors.list().pipe(catchError(() => of([]))),
    }).subscribe(({ plan, vendors }) => {
      this.weddingDate.set(plan?.weddingDate ?? null);
      this.people.set(
        [plan?.firstName, plan?.partnerFirstName]
          .filter((n): n is string => !!n?.trim())
          .map((name) => ({ name: name.trim(), contact: null })),
      );
      this.allVendors.set(vendors);
    });
  }

  // ------------------------------------------------------------------ examples

  /**
   * Put an example into the day. An empty day takes it straight away; otherwise the couple confirms
   * replacing what's there. From the link (?use=), the parameter is dropped afterwards so a reload
   * doesn't ask again.
   */
  protected async useExample(key: string, fromLink = false): Promise<void> {
    const rows = scheduleRows(key, this.lang.current());
    if (fromLink) void this.router.navigate([], { queryParams: { use: null }, queryParamsHandling: 'merge', replaceUrl: true });
    if (!rows) return;

    const replace = this.items().length > 0;
    if (replace) {
      const ok = await this.confirm.confirm({
        title: 'day.replaceTitle',
        body: 'day.replaceBody',
        confirmLabel: 'day.replace',
        danger: true,
      });
      if (!ok) return;
    }
    this.day.useTemplate(rows, replace).subscribe({
      next: (items) => {
        this.items.set(items);
        this.showExamples.set(false);
        this.toast.success('day.exampleAdded');
      },
      error: () => this.toast.error('day.saveError'),
    });
  }

  // ------------------------------------------------------------------ add / edit / delete

  protected startAdd(): void {
    this.form.reset({ time: '', activity: '', note: '', who: '', contact: '' });
    this.editing.set('new');
    this.focusForm();
  }

  protected startEdit(item: DayItem): void {
    this.form.reset({
      time: item.time ?? '',
      activity: item.activity,
      note: item.note ?? '',
      who: item.who ?? '',
      contact: item.contact ?? '',
    });
    this.editing.set(item.id);
    this.focusForm();
  }

  protected cancel(): void {
    this.editing.set(null);
  }

  /** Picking a saved vendor (or a partner) as "who" fills in their phone if contact is empty. */
  protected onWho(): void {
    const who = this.form.controls.who.value?.trim();
    const match = this.suggestions().find((s) => s.name === who);
    if (match?.contact && !this.form.controls.contact.value?.trim()) {
      this.form.controls.contact.setValue(match.contact);
    }
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      (this.host.nativeElement.querySelector('#day-activity') as HTMLElement | null)?.focus();
      return;
    }
    const v = this.form.getRawValue();
    const t = (s: string | null | undefined) => (s ?? '').trim() || null;
    const body: DayItemEdit = {
      time: t(v.time),
      activity: (v.activity ?? '').trim(),
      note: t(v.note),
      who: t(v.who),
      contact: t(v.contact),
    };
    const editing = this.editing();
    this.saving.set(true);
    const request = editing === 'new' ? this.day.create(body) : this.day.update(editing as number, body);
    request.subscribe({
      next: (saved) => {
        this.items.update((list) => this.sorted(editing === 'new' ? [...list, saved] : list.map((i) => (i.id === saved.id ? saved : i))));
        this.editing.set(null);
        this.saving.set(false);
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('day.saveError');
      },
    });
  }

  protected async remove(item: DayItem): Promise<void> {
    const ok = await this.confirm.confirm({
      title: 'day.deleteTitle',
      detail: item.activity,
      confirmLabel: 'day.delete',
      danger: true,
    });
    if (!ok) return;
    this.day.remove(item.id).subscribe({
      next: () => this.items.update((list) => list.filter((i) => i.id !== item.id)),
      error: () => this.toast.error('day.saveError'),
    });
  }

  protected async clearAll(): Promise<void> {
    const ok = await this.confirm.confirm({
      title: 'day.clearTitle',
      body: 'day.clearBody',
      confirmLabel: 'day.clear',
      danger: true,
    });
    if (!ok) return;
    this.day.clear().subscribe({
      next: () => this.items.set([]),
      error: () => this.toast.error('day.saveError'),
    });
  }

  // ------------------------------------------------------------------ order

  /** Only activities at the same time can swap: otherwise the time decides the order. */
  protected canSwap(i: number, delta: -1 | 1): boolean {
    const list = this.items();
    const other = list[i + delta];
    return !!other && other.time === list[i].time;
  }

  protected move(i: number, delta: -1 | 1): void {
    if (!this.canSwap(i, delta)) return;
    const before = this.items();
    const list = before.slice();
    [list[i], list[i + delta]] = [list[i + delta], list[i]];
    this.items.set(list.map((item, n) => ({ ...item, sortOrder: n })));
    this.day.reorder(list.map((x) => x.id)).subscribe({
      error: () => {
        this.items.set(before);
        this.toast.error('day.saveError');
      },
    });
  }

  // ------------------------------------------------------------------ view helpers

  protected dateLabel(): string | null {
    const d = this.weddingDate();
    return d ? formatDate(d, this.lang.current()) : null;
  }

  /** A phone number becomes a tap-to-call link; anything else stays text. */
  protected phoneHref(contact: string | null): string | null {
    if (!contact) return null;
    const digits = contact.replace(/[^\d+]/g, '');
    return /^\+?\d{6,15}$/.test(digits) ? `tel:${digits}` : null;
  }

  private sorted(list: DayItem[]): DayItem[] {
    return list.slice().sort((a, b) => dayTimeKey(a.time) - dayTimeKey(b.time) || a.sortOrder - b.sortOrder);
  }

  private focusForm(): void {
    setTimeout(() => (this.host.nativeElement.querySelector('#day-time') as HTMLElement | null)?.focus());
  }
}
