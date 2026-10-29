import { Component, ElementRef, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Meta, Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { EMPTY, catchError, concatMap, finalize, from, tap } from 'rxjs';

import { focusFirstInvalid } from '../../core/forms';
import {
  CATEGORIES,
  FEATURES,
  GroupKey,
  PRICE_UNITS,
  REGIONS,
  SETTINGS,
  TRAVEL_POLICIES,
  VENUE_TYPES,
  categoriesIn,
  defaultUnit,
  groupOf,
  stylesFor,
} from '../../core/catalog';

import {
  DashboardService,
  InboxMessage,
  VendorDashboard,
  VendorPackageEdit,
  VendorPhotoAdmin,
  VendorStats,
} from '../../core/dashboard.service';
import { ConfirmService } from '../../core/confirm.service';
import { ToastService } from '../../core/toast.service';
import { LanguageService } from '../../i18n/language.service';
import { NotificationService } from '../../core/notification.service';
import { formatDate } from '../../core/dates';

type DashSection = 'overview' | 'profile' | 'photos' | 'messages';

@Component({
  selector: 'app-dashboard',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, CdkDropList, CdkDrag, CdkDragHandle],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  host: { class: 'theme-brand' },
})
export class Dashboard {
  private readonly fb = inject(FormBuilder);
  private readonly dashboard = inject(DashboardService);
  private readonly confirmSvc = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly lang = inject(LanguageService);
  private readonly route = inject(ActivatedRoute);
  private readonly notif = inject(NotificationService);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * Set on /admin/vendors/:id: an admin edits that vendor (usually an imported profile with no
   * owner yet). Only the profile and photos show; the inbox and stats stay the vendor's own.
   */
  private readonly vendorId: number | undefined = (() => {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    return Number.isInteger(id) && id > 0 ? id : undefined;
  })();
  protected readonly adminMode = this.vendorId !== undefined;

  protected readonly vendor = signal<VendorDashboard | null>(null);
  protected readonly stats = signal<VendorStats | null>(null);
  protected readonly messages = signal<InboxMessage[]>([]);
  protected readonly loadError = signal(false);
  /** Per-panel fetch failures — shown as error notes, never as fake zeros / "no messages". */
  protected readonly statsError = signal(false);
  protected readonly messagesError = signal(false);
  protected readonly saved = signal(false);
  protected readonly saving = signal(false);
  /** The server rejected the WhatsApp number on save — inline error on that field. */
  protected readonly whatsappInvalid = signal(false);

  protected readonly photos = signal<VendorPhotoAdmin[]>([]);
  protected readonly uploading = signal(false);
  protected readonly uploadError = signal(false);

  /** Photo order last confirmed by the server — what the grid reverts to if a reorder fails. */
  private lastSavedIds: number[] = [];
  private reorderInFlight = false;
  private pendingOrder: number[] | null = null;

  /** Which section of the dashboard shell is showing. */
  protected readonly activeSection = signal<DashSection>(this.adminMode ? 'profile' : 'overview');

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
        done: !!(v?.phone || v?.instagram || v?.facebook || v?.whatsapp),
        section: 'profile' as DashSection,
      },
    ];
    const done = items.filter((i) => i.done).length;
    return { items, done, total: items.length, pct: Math.round((done / items.length) * 100) };
  });

  // Max lengths mirror the server's VendorEditDto caps so over-long input fails
  // client-side with feedback instead of a silent 400.
  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    city: [''],
    bio: ['', [Validators.maxLength(4000)]],
    priceMin: [null as number | null],
    priceRange: ['', [Validators.maxLength(120)]],
    instagram: ['', [Validators.maxLength(200)]],
    facebook: ['', [Validators.maxLength(200)]],
    phone: ['', [Validators.maxLength(40)]],
    whatsapp: [''],
    mapUrl: ['', [Validators.maxLength(1000)]],
    // ---- catalog attributes (PROPOSALS.md P2–P5) ----
    priceUnit: [''],
    region: [''],
    capacityMin: [null as number | null, [Validators.min(1), Validators.max(5000)]],
    capacityMax: [null as number | null, [Validators.min(1), Validators.max(5000)]],
    setting: [''],
    venueType: [''],
    depositTerms: ['', [Validators.maxLength(200)]],
    cancellationTerms: ['', [Validators.maxLength(500)]],
    travelPolicy: [''],
    bookingLeadTime: ['', [Validators.maxLength(100)]],
    packages: this.fb.array<FormGroup>([]),
  });

  // Multi-choice attributes, edited as checkbox lists.
  protected readonly servedRegions = signal<string[]>([]);
  protected readonly alsoOffers = signal<string[]>([]);
  protected readonly chosenStyles = signal<string[]>([]);
  protected readonly chosenFeatures = signal<string[]>([]);

  protected readonly regions = REGIONS;
  protected readonly priceUnits = PRICE_UNITS;
  protected readonly settingsList = SETTINGS;
  protected readonly venueTypes = VENUE_TYPES;
  protected readonly travelPolicies = TRAVEL_POLICIES;
  protected readonly maxPackages = 5;

  /** The vendor's catalog group decides which attributes apply (venue fields, styles…). */
  protected readonly group = computed<GroupKey | null>(() => {
    const slug = this.vendor()?.categorySlug;
    return slug ? (groupOf(slug) ?? null) : null;
  });
  protected readonly sameGroupCategories = computed(() => {
    const g = this.group();
    const own = this.vendor()?.categorySlug;
    return g ? categoriesIn(g).filter((c) => c.slug !== own) : [];
  });
  protected readonly groupStyles = computed(() => {
    const g = this.group();
    return g ? stylesFor(g) : [];
  });
  protected readonly groupFeatures = computed(() => {
    const g = this.group();
    return g ? FEATURES[g] : [];
  });
  protected readonly defaultUnit = computed(() => defaultUnit(this.group() ?? undefined));
  /** Regions offered as "also works in": everything except the vendor's own region. */
  protected readonly otherRegions = computed(() => REGIONS.filter((r) => r !== this.ownRegion()));
  /** Mirrors the form's region control (kept in sync by a valueChanges subscription). */
  private readonly ownRegion = signal('');

  protected get packages(): FormArray<FormGroup> {
    return this.form.controls.packages;
  }

  constructor() {
    const t = inject(TranslateService);
    inject(Title).setTitle(`${t.instant(this.adminMode ? 'dash.adminTitle' : 'dash.title')} | ${t.instant('brand.name')}`);
    // Private: a vendor's own dashboard (or the admin's view of it).
    inject(Meta).updateTag({ name: 'robots', content: 'noindex' });

    // Editing any field makes the "Saved" badge a lie — clear it (and the
    // WhatsApp error, which the vendor is presumably correcting) on any change.
    this.form.valueChanges.subscribe(() => {
      this.saved.set(false);
      this.whatsappInvalid.set(false);
    });
    this.form.controls.region.valueChanges.subscribe((r) => {
      this.ownRegion.set(r ?? '');
      // The own region can't also be an "also works in" region.
      if (r) this.servedRegions.update((list) => list.filter((x) => x !== r));
    });

    // Open a specific tab when navigated with ?tab= (e.g. the navbar notification bell → messages).
    this.route.queryParamMap.subscribe((pm) => {
      const tab = pm.get('tab');
      const section = this.sections.find((x) => x === tab);
      if (section) {
        this.activeSection.set(section);
      }
    });

    if (this.isBrowser) {
      this.dashboard.getMyVendor(this.vendorId).subscribe({
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
            whatsapp: v.whatsapp ?? '',
            mapUrl: v.mapUrl ?? '',
            // The empty option stands for the group's default unit, which isn't listed again, so
            // a stored default ("event" for a photographer: imports, the A2 backfill) maps to it.
            priceUnit: v.priceUnit && v.priceUnit !== this.defaultUnit() ? v.priceUnit : '',
            region: v.region ?? '',
            capacityMin: v.capacityMin,
            capacityMax: v.capacityMax,
            setting: v.setting ?? '',
            venueType: v.venueType ?? '',
            depositTerms: v.depositTerms ?? '',
            cancellationTerms: v.cancellationTerms ?? '',
            travelPolicy: v.travelPolicy ?? '',
            bookingLeadTime: v.bookingLeadTime ?? '',
          });
          this.servedRegions.set(v.servedRegions ?? []);
          this.alsoOffers.set(v.alsoOffers ?? []);
          this.chosenStyles.set(v.styles ?? []);
          this.chosenFeatures.set(v.features ?? []);
          this.packages.clear();
          (v.packages ?? []).forEach((p) => this.addPackage(p));
          this.form.markAsPristine();
          this.saved.set(false);
        },
        error: () => this.loadError.set(true),
      });
      if (!this.adminMode) {
        this.dashboard.getStats().subscribe({
          next: (s) => this.stats.set(s),
          error: () => this.statsError.set(true),
        });
        this.dashboard.getMessages().subscribe({
          next: (m) => {
            this.messages.set(m);
            this.notif.setUnread(m.filter((x) => !x.isRead).length); // keep the navbar badge exact
          },
          error: () => this.messagesError.set(true),
        });
      }
      this.dashboard.getPhotos(this.vendorId).subscribe({
        next: (p) => {
          this.photos.set(p);
          this.lastSavedIds = p.map((x) => x.id);
        },
        error: () => {},
      });
    }
  }

  protected onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    input.value = ''; // allow re-selecting the same file
    if (!files.length) return;

    this.uploadError.set(false);
    this.uploading.set(true);
    // Sequential (concatMap), not parallel: parallel uploads get their SortOrder
    // from response timing, shuffling files that were picked together.
    from(files)
      .pipe(
        concatMap((file) =>
          this.dashboard.uploadPhoto(file, this.vendorId).pipe(
            tap((p) => {
              this.photos.update((list) => [...list, p]);
              this.lastSavedIds = [...this.lastSavedIds, p.id];
            }),
            catchError(() => {
              this.uploadError.set(true);
              return EMPTY; // keep uploading the remaining files
            }),
          ),
        ),
        finalize(() => this.uploading.set(false)),
      )
      .subscribe();
  }

  protected async deletePhoto(photo: VendorPhotoAdmin): Promise<void> {
    const ok = await this.confirmSvc.confirm({
      title: 'dash.deleteConfirmTitle',
      body: 'dash.deleteConfirmBody',
      confirmLabel: 'dash.deletePhoto',
      danger: true,
    });
    if (!ok) return;

    this.dashboard.deletePhoto(photo.id, this.vendorId).subscribe({
      next: () => {
        this.photos.update((list) => list.filter((p) => p.id !== photo.id));
        this.lastSavedIds = this.lastSavedIds.filter((id) => id !== photo.id);
      },
      error: () => this.toast.error('dash.deleteError'),
    });
  }

  protected toggleReal(photo: VendorPhotoAdmin): void {
    const next = !photo.isRealWedding;
    // Optimistic — the checkbox flips instantly; revert it (and say so) on failure.
    this.photos.update((list) =>
      list.map((p) => (p.id === photo.id ? { ...p, isRealWedding: next } : p)),
    );
    this.dashboard.updatePhoto(photo.id, { alt: photo.alt, isRealWedding: next }, this.vendorId).subscribe({
      error: () => {
        this.photos.update((list) =>
          list.map((p) => (p.id === photo.id ? { ...p, isRealWedding: photo.isRealWedding } : p)),
        );
        this.toast.error('dash.photoError');
      },
    });
  }

  protected saveAlt(photo: VendorPhotoAdmin, event: Event): void {
    const input = event.target as HTMLInputElement;
    const alt = input.value.trim();
    if (alt === (photo.alt ?? '')) return;
    this.dashboard.updatePhoto(photo.id, { alt, isRealWedding: photo.isRealWedding }, this.vendorId).subscribe({
      next: () =>
        this.photos.update((list) => list.map((p) => (p.id === photo.id ? { ...p, alt } : p))),
      error: () => {
        input.value = photo.alt ?? ''; // put the field back to what's actually saved
        this.toast.error('dash.photoError');
      },
    });
  }

  /** Drag-and-drop reorder (pointer + touch). Arrow buttons remain for keyboard access. */
  protected drop(event: CdkDragDrop<VendorPhotoAdmin[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const list = this.photos().slice();
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    this.photos.set(list);
    this.queueReorder(list.map((p) => p.id));
  }

  protected move(index: number, delta: number): void {
    const list = this.photos().slice();
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    this.photos.set(list);
    this.queueReorder(list.map((p) => p.id));
    // Keyboard continuity: when the moved photo reaches an end position, the
    // pressed ↑/↓ becomes [disabled] and focus would drop to <body>, stranding
    // the user mid-reorder. Re-focus after render: same-direction button while
    // it stays enabled (repeat presses keep walking), else its sibling.
    if (this.isBrowser) {
      setTimeout(() => {
        const card = this.host.nativeElement.querySelectorAll('.photo-card')[target] as
          | HTMLElement
          | undefined;
        const nudges = card?.querySelectorAll<HTMLButtonElement>('.photo-card__nudge');
        if (!nudges?.length) return;
        const pressed = delta < 0 ? nudges[0] : nudges[nudges.length - 1];
        const sibling = delta < 0 ? nudges[nudges.length - 1] : nudges[0];
        (pressed.disabled ? sibling : pressed)?.focus();
      });
    }
  }

  /**
   * Reorder PUTs are serialized: at most one in flight, and only the NEWEST
   * pending order is kept while it runs. The server therefore never sees two
   * order requests racing (where the stale one could land last and win), and
   * rapid drags collapse into the final order.
   */
  private queueReorder(ids: number[]): void {
    if (this.reorderInFlight) {
      this.pendingOrder = ids;
      return;
    }
    this.sendReorder(ids);
  }

  private sendReorder(ids: number[]): void {
    this.reorderInFlight = true;
    this.dashboard.reorderPhotos(ids, this.vendorId).subscribe({
      next: () => {
        this.lastSavedIds = ids;
        this.finishReorder();
      },
      error: () => {
        // Revert to the last server-confirmed order — unless a newer order is
        // already queued, in which case that one supersedes this failure.
        if (!this.pendingOrder) {
          const rank = new Map(this.lastSavedIds.map((id, i) => [id, i]));
          this.photos.update((list) =>
            list
              .slice()
              .sort((a, b) => (rank.get(a.id) ?? list.length) - (rank.get(b.id) ?? list.length)),
          );
          this.toast.error('dash.reorderError');
        }
        this.finishReorder();
      },
    });
  }

  private finishReorder(): void {
    this.reorderInFlight = false;
    const next = this.pendingOrder;
    this.pendingOrder = null;
    if (next) this.sendReorder(next);
  }

  // ---- multi-choice + packages ----

  protected toggleIn(list: 'servedRegions' | 'alsoOffers' | 'chosenStyles' | 'chosenFeatures', value: string): void {
    this[list].update((items) => (items.includes(value) ? items.filter((x) => x !== value) : [...items, value]));
    this.saved.set(false);
  }

  protected addPackage(p?: VendorPackageEdit): void {
    if (this.packages.length >= this.maxPackages) return;
    this.packages.push(
      this.fb.group({
        name: [p?.name ?? '', [Validators.required, Validators.maxLength(120)]],
        price: [p?.price ?? (null as number | null), [Validators.min(0)]],
        priceUnit: [p?.priceUnit ?? ''],
        included: [p?.included ?? '', [Validators.maxLength(1000)]],
        duration: [p?.duration ?? '', [Validators.maxLength(60)]],
      }),
    );
  }

  protected removePackage(i: number): void {
    this.packages.removeAt(i);
    this.form.markAsDirty();
  }

  /** Min > max is the one cross-field rule the API also enforces. */
  protected readonly capacityInvalid = signal(false);

  protected save(): void {
    const { capacityMin, capacityMax } = this.form.getRawValue();
    this.capacityInvalid.set(capacityMin != null && capacityMax != null && capacityMin > capacityMax);
    if (this.form.invalid || this.capacityInvalid()) {
      this.form.markAllAsTouched();
      focusFirstInvalid(this.host.nativeElement);
      if (this.capacityInvalid()) (this.host.nativeElement.querySelector('#d-cmin') as HTMLElement | null)?.focus();
      return;
    }
    this.saving.set(true);
    this.saved.set(false);
    this.whatsappInvalid.set(false);
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
        whatsapp: v.whatsapp,
        mapUrl: v.mapUrl,
        priceUnit: v.priceUnit || null,
        region: v.region || null,
        servedRegions: this.servedRegions(),
        alsoOffers: this.alsoOffers(),
        styles: this.chosenStyles(),
        features: this.chosenFeatures(),
        capacityMin: v.capacityMin,
        capacityMax: v.capacityMax,
        setting: v.setting || null,
        venueType: v.venueType || null,
        depositTerms: v.depositTerms || null,
        cancellationTerms: v.cancellationTerms || null,
        travelPolicy: v.travelPolicy || null,
        bookingLeadTime: v.bookingLeadTime || null,
        packages: (v.packages as VendorPackageEdit[]).map((p) => ({
          name: p.name.trim(),
          price: p.price,
          priceUnit: p.priceUnit || null,
          included: p.included || null,
          duration: p.duration || null,
        })),
      }, this.vendorId)
      .subscribe({
        next: (updated) => {
          this.vendor.set(updated);
          this.saving.set(false);
          this.saved.set(true);
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          // The API 400s with a ValidationProblem keyed "whatsapp" when a
          // non-empty number can't be normalized — surface it on the field
          // instead of pretending the profile saved. DataAnnotations failures
          // (e.g. over MaxLength) key by PROPERTY name ("Whatsapp"), so check both.
          if (err.status === 400 && (err.error?.errors?.['whatsapp'] ?? err.error?.errors?.['Whatsapp'])) {
            this.whatsappInvalid.set(true);
            (this.host.nativeElement.querySelector('#d-wa') as HTMLElement | null)?.focus();
          } else {
            // Any other failure (500, offline, other validation) must not end
            // in silence — the vendor would believe the profile saved.
            this.toast.error('dash.saveError');
          }
        },
      });
  }

  protected markRead(id: number): void {
    const msg = this.messages().find((m) => m.id === id);
    if (!msg || msg.isRead) return; // already read, or a prior click already has this in flight

    // Optimistic: flip isRead now so the button disappears immediately and a
    // double-click can't fire the request (and decrement the badge) twice.
    this.messages.update((list) => list.map((m) => (m.id === id ? { ...m, isRead: true } : m)));
    this.notif.markOneRead();

    this.dashboard.markRead(id).subscribe({
      error: () => {
        this.messages.update((list) => list.map((m) => (m.id === id ? { ...m, isRead: false } : m)));
        this.notif.refresh();
      },
    });
  }

  /** Georgian month names spelled out, the same on server and browser (core/dates). */
  protected formatDate(iso: string): string {
    return formatDate(iso, this.lang.current(), 'medium');
  }

  protected setSection(section: DashSection): void {
    this.activeSection.set(section);
  }

  /** Tab order for the sidebar tablist's keyboard navigation (an admin sees two of them). */
  private readonly sections: DashSection[] = this.adminMode
    ? ['profile', 'photos']
    : ['overview', 'profile', 'photos', 'messages'];

  /**
   * WAI-ARIA tabs pattern (vertical tablist, roving tabindex in the template):
   * arrows move focus AND select — switching is cheap and local, so
   * selection-follows-focus is the right variant. Home/End jump to the ends.
   */
  protected onTabKeydown(event: KeyboardEvent): void {
    const current = this.sections.indexOf(this.activeSection());
    const last = this.sections.length - 1;
    let next: number;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        next = current === last ? 0 : current + 1;
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        next = current === 0 ? last : current - 1;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    const section = this.sections[next];
    this.activeSection.set(section);
    (this.host.nativeElement.querySelector(`#tab-${section}`) as HTMLElement | null)?.focus();
  }

  /** i18n key for a category slug (for the vendor identity subtitle). */
  protected categoryKey(slug: string): string {
    return CATEGORIES.find((c) => c.slug === slug)?.key ?? '';
  }
}
