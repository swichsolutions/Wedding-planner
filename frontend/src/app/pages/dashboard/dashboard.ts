import { Component, ElementRef, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { focusFirstInvalid } from '../../core/forms';
import { CATEGORIES } from '../../core/catalog';

import {
  DashboardService,
  InboxMessage,
  VendorDashboard,
  VendorPhotoAdmin,
  VendorStats,
} from '../../core/dashboard.service';
import { LanguageService } from '../../i18n/language.service';
import { NotificationService } from '../../core/notification.service';

type DashSection = 'overview' | 'profile' | 'photos' | 'messages';

@Component({
  selector: 'app-dashboard',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, CdkDropList, CdkDrag, CdkDragHandle],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly fb = inject(FormBuilder);
  private readonly dashboard = inject(DashboardService);
  private readonly lang = inject(LanguageService);
  private readonly route = inject(ActivatedRoute);
  private readonly notif = inject(NotificationService);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly vendor = signal<VendorDashboard | null>(null);
  protected readonly stats = signal<VendorStats | null>(null);
  protected readonly messages = signal<InboxMessage[]>([]);
  protected readonly loadError = signal(false);
  protected readonly saved = signal(false);
  protected readonly saving = signal(false);

  protected readonly photos = signal<VendorPhotoAdmin[]>([]);
  protected readonly uploading = signal(false);
  protected readonly uploadError = signal(false);

  /** Which section of the dashboard shell is showing. */
  protected readonly activeSection = signal<DashSection>('overview');

  /** Live unread count (updates on markRead) for the Messages tab badge. */
  protected readonly unreadCount = computed(() => this.messages().filter((m) => !m.isRead).length);

  /** Profile-strength checklist — nudges the vendor to fill the fields couples care about. */
  protected readonly strength = computed(() => {
    const v = this.vendor();
    const items = [
      { key: 'dash.strengthBio', done: !!v?.bio?.trim(), section: 'profile' as DashSection },
      { key: 'dash.strengthPrice', done: v?.priceMin != null, section: 'profile' as DashSection },
      { key: 'dash.strengthPhotos', done: this.photos().length > 0, section: 'photos' as DashSection },
      {
        key: 'dash.strengthContact',
        done: !!(v?.phone || v?.instagram || v?.facebook),
        section: 'profile' as DashSection,
      },
    ];
    const done = items.filter((i) => i.done).length;
    return { items, done, total: items.length, pct: Math.round((done / items.length) * 100) };
  });

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    city: [''],
    bio: [''],
    priceMin: [null as number | null],
    priceRange: [''],
    instagram: [''],
    facebook: [''],
    phone: [''],
    mapUrl: [''],
  });

  constructor() {
    const t = inject(TranslateService);
    inject(Title).setTitle(`${t.instant('dash.title')} | ${t.instant('brand.name')}`);

    // Open a specific tab when navigated with ?tab= (e.g. the navbar notification bell → messages).
    this.route.queryParamMap.subscribe((pm) => {
      const tab = pm.get('tab');
      if (tab === 'overview' || tab === 'profile' || tab === 'photos' || tab === 'messages') {
        this.activeSection.set(tab);
      }
    });

    if (this.isBrowser) {
      this.dashboard.getMyVendor().subscribe({
        next: (v) => {
          this.vendor.set(v);
          this.form.patchValue({
            name: v.name,
            city: v.city ?? '',
            bio: v.bio ?? '',
            priceMin: v.priceMin,
            priceRange: v.priceRange ?? '',
            instagram: v.instagram ?? '',
            facebook: v.facebook ?? '',
            phone: v.phone ?? '',
            mapUrl: v.mapUrl ?? '',
          });
        },
        error: () => this.loadError.set(true),
      });
      this.dashboard.getStats().subscribe({ next: (s) => this.stats.set(s), error: () => {} });
      this.dashboard.getMessages().subscribe({
        next: (m) => {
          this.messages.set(m);
          this.notif.setUnread(m.filter((x) => !x.isRead).length); // keep the navbar badge exact
        },
        error: () => {},
      });
      this.dashboard.getPhotos().subscribe({ next: (p) => this.photos.set(p), error: () => {} });
    }
  }

  protected onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    input.value = ''; // allow re-selecting the same file
    if (!files.length) return;

    this.uploadError.set(false);
    this.uploading.set(true);
    let remaining = files.length;
    for (const file of files) {
      this.dashboard.uploadPhoto(file).subscribe({
        next: (p) => this.photos.update((list) => [...list, p]),
        error: () => {
          this.uploadError.set(true);
          if (--remaining === 0) this.uploading.set(false);
        },
        complete: () => {
          if (--remaining === 0) this.uploading.set(false);
        },
      });
    }
  }

  protected deletePhoto(id: number): void {
    this.dashboard.deletePhoto(id).subscribe({
      next: () => this.photos.update((list) => list.filter((p) => p.id !== id)),
      error: () => {},
    });
  }

  protected toggleReal(photo: VendorPhotoAdmin): void {
    const next = !photo.isRealWedding;
    this.dashboard.updatePhoto(photo.id, { alt: photo.alt, isRealWedding: next }).subscribe({
      next: () =>
        this.photos.update((list) =>
          list.map((p) => (p.id === photo.id ? { ...p, isRealWedding: next } : p)),
        ),
      error: () => {},
    });
  }

  protected saveAlt(photo: VendorPhotoAdmin, event: Event): void {
    const alt = (event.target as HTMLInputElement).value.trim();
    if (alt === (photo.alt ?? '')) return;
    this.dashboard.updatePhoto(photo.id, { alt, isRealWedding: photo.isRealWedding }).subscribe({
      next: () =>
        this.photos.update((list) => list.map((p) => (p.id === photo.id ? { ...p, alt } : p))),
      error: () => {},
    });
  }

  /** Drag-and-drop reorder (pointer + touch). Arrow buttons remain for keyboard access. */
  protected drop(event: CdkDragDrop<VendorPhotoAdmin[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const list = this.photos().slice();
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    this.photos.set(list);
    this.dashboard.reorderPhotos(list.map((p) => p.id)).subscribe({ error: () => {} });
  }

  protected move(index: number, delta: number): void {
    const list = this.photos().slice();
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    this.photos.set(list);
    this.dashboard.reorderPhotos(list.map((p) => p.id)).subscribe({ error: () => {} });
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalid(this.host.nativeElement);
      return;
    }
    this.saving.set(true);
    this.saved.set(false);
    const v = this.form.getRawValue();
    this.dashboard
      .updateMyVendor({
        name: v.name!,
        city: v.city,
        bio: v.bio,
        priceMin: v.priceMin,
        priceRange: v.priceRange,
        instagram: v.instagram,
        facebook: v.facebook,
        phone: v.phone,
        mapUrl: v.mapUrl,
      })
      .subscribe({
        next: (updated) => {
          this.vendor.set(updated);
          this.saving.set(false);
          this.saved.set(true);
        },
        error: () => this.saving.set(false),
      });
  }

  protected markRead(id: number): void {
    this.dashboard.markRead(id).subscribe({
      next: () => {
        this.messages.update((list) => list.map((m) => (m.id === id ? { ...m, isRead: true } : m)));
        this.notif.markOneRead(); // update the navbar badge immediately
      },
      error: () => {},
    });
  }

  protected formatDate(iso: string): string {
    const locale = this.lang.current() === 'en' ? 'en-US' : 'ka-GE';
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso));
  }

  protected setSection(section: DashSection): void {
    this.activeSection.set(section);
  }

  /** i18n key for a category slug (for the vendor identity subtitle). */
  protected categoryKey(slug: string): string {
    return CATEGORIES.find((c) => c.slug === slug)?.key ?? '';
  }
}
