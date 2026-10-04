import { Component, ElementRef, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, concatMap, from, of } from 'rxjs';

import { trapTabKey } from '../../core/a11y';
import { AuthService } from '../../core/auth.service';
import { CoupleProfile, CoupleService } from '../../core/couple.service';
import { Guest, GuestInvitedStatus, GuestPayload, GuestRelationship, GuestService } from '../../core/guest.service';
import { ConfirmService } from '../../core/confirm.service';
import { ToastService } from '../../core/toast.service';

interface RelationshipOption {
  value: GuestRelationship;
  key: string;
  params?: Record<string, string>;
}

/** Everything the manual-entry form captures for one guest, minus server-assigned fields. */
type GuestFormValues = Omit<Guest, 'id' | 'sortOrder'>;

// Simple, permissive formats — this is a guest list, not a billing form: "needs an @
// and a domain" / "digits only (an optional leading +)" is the bar, not RFC 5322.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?\d+$/;

/**
 * Couple guest list. Deliberately starts empty (no seeding, unlike the checklist/
 * budget) — the "start building your list" prompt is the first thing a couple sees.
 */
@Component({
  selector: 'app-guest-list',
  imports: [RouterLink, TranslatePipe],
  templateUrl: './guest-list.html',
  styleUrl: './guest-list.scss',
  host: { '(document:keydown.escape)': 'closeSidebar()' },
})
export class GuestList {
  private readonly auth = inject(AuthService);
  private readonly guestSvc = inject(GuestService);
  private readonly coupleSvc = inject(CoupleService);
  private readonly confirmSvc = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly t = inject(TranslateService);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly doc = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly isCouple = this.auth.isCouple;
  private coupleLoadStarted = false;

  protected readonly guests = signal<Guest[]>([]);
  protected readonly loaded = signal(false);
  protected readonly loadError = signal(false);
  protected readonly importing = signal(false);
  protected readonly couple = signal<CoupleProfile | null>(null);

  // ---- row selection (header "select all" + per-row checkboxes) ----
  protected readonly selectedIds = signal<Set<number>>(new Set());
  protected readonly allSelected = computed(
    () => this.guests().length > 0 && this.guests().every((g) => this.selectedIds().has(g.id)),
  );
  protected readonly someSelected = computed(() => this.selectedIds().size > 0 && !this.allSelected());

  protected isSelected(id: number): boolean {
    return this.selectedIds().has(id);
  }

  protected toggleSelect(id: number): void {
    this.selectedIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected toggleSelectAll(): void {
    this.selectedIds.set(this.allSelected() ? new Set() : new Set(this.guests().map((g) => g.id)));
  }

  protected partySize(guest: Guest): number {
    return 1 + (guest.hasPlusOne ? 1 : 0) + (guest.hasChild ? 1 : 0);
  }

  // ---- headcount summary (total / adults / children / invited-status split) ----
  // "Adults" = every primary guest plus any plus-one (a plus-one is always an
  // adult by definition here — there's no separate flag for it); "definitely"/
  // "maybe" are headcounts (party size), not row counts, since what a couple
  // actually needs from these is "how many people", not "how many entries".
  protected readonly totalGuestsCount = computed(() =>
    this.guests().reduce((sum, g) => sum + this.partySize(g), 0),
  );
  protected readonly adultsCount = computed(() =>
    this.guests().reduce((sum, g) => sum + 1 + (g.hasPlusOne ? 1 : 0), 0),
  );
  protected readonly childrenCount = computed(() =>
    this.guests().reduce((sum, g) => sum + (g.hasChild ? 1 : 0), 0),
  );
  protected readonly definitelyCount = computed(() =>
    this.guests()
      .filter((g) => g.invitedStatus === 'definitely')
      .reduce((sum, g) => sum + this.partySize(g), 0),
  );
  protected readonly maybeCount = computed(() =>
    this.guests()
      .filter((g) => g.invitedStatus === 'maybe')
      .reduce((sum, g) => sum + this.partySize(g), 0),
  );

  /** The "Add guests" button opens a chooser (manual vs. spreadsheet). Picking
   *  "Enter manually" swaps the same sliding panel to a richer per-guest form
   *  instead of stacking a second overlay; the edit icon on a row opens the same
   *  form directly (skipping the chooser) pre-filled for that guest. */
  protected readonly sidebarOpen = signal(false);
  protected readonly drawerView = signal<'choose' | 'manual'>('choose');
  private sidebarTrigger: HTMLElement | null = null;

  // ---- manual guest form state ----
  protected readonly savingGuest = signal(false);
  protected readonly guestFormAttempted = signal(false);
  protected readonly hasPlusOne = signal(false);
  protected readonly plusOneNameUnknown = signal(false);
  protected readonly hasChild = signal(false);
  protected readonly childNameUnknown = signal(false);
  protected readonly editingGuestId = signal<number | null>(null);
  protected readonly isEditing = computed(() => this.editingGuestId() !== null);

  protected readonly relationshipOptions = computed<RelationshipOption[]>(() => {
    const c = this.couple();
    const name1 = (c?.firstName || '').trim() || this.t.instant('guestListPage.partnerOneFallback');
    const name2 = (c?.partnerFirstName || '').trim() || this.t.instant('guestListPage.partnerTwoFallback');
    const options: RelationshipOption[] = [
      { value: 'none', key: 'guestListPage.relationshipNone' },
      { value: 'person1_family', key: 'guestListPage.relationshipFamily', params: { name: name1 } },
      { value: 'person1_friend', key: 'guestListPage.relationshipFriend', params: { name: name1 } },
      { value: 'person1_family_friend', key: 'guestListPage.relationshipFamilyFriend', params: { name: name1 } },
      { value: 'person2_family', key: 'guestListPage.relationshipFamily', params: { name: name2 } },
      { value: 'person2_friend', key: 'guestListPage.relationshipFriend', params: { name: name2 } },
      { value: 'person2_family_friend', key: 'guestListPage.relationshipFamilyFriend', params: { name: name2 } },
      { value: 'both_friend', key: 'guestListPage.relationshipBothFriend', params: { name1, name2 } },
    ];
    return options;
  });

  constructor() {
    inject(Title).setTitle(`${this.t.instant('guestListPage.title')} | ${this.t.instant('brand.name')}`);
    inject(Meta).updateTag({ name: 'description', content: this.t.instant('guestListPage.subtitle') });

    effect(() => {
      if (!this.isBrowser || !this.isCouple() || this.coupleLoadStarted) return;
      this.coupleLoadStarted = true;
      this.loadGuests();
      this.coupleSvc.me().subscribe({
        next: (c) => this.couple.set(c),
        error: () => {},
      });
    });

    // Sidebar dialog contract: scroll lock + focus the first control on open,
    // restore focus to whatever opened it on close.
    effect(() => {
      const open = this.sidebarOpen();
      if (!this.isBrowser) return;
      this.doc.body.style.overflow = open ? 'hidden' : '';
      if (open) {
        setTimeout(() => this.focusFirstDrawerControl());
      } else {
        this.sidebarTrigger?.focus();
        this.sidebarTrigger = null;
      }
    });

    // Re-focus the first field whenever the drawer swaps to the manual form.
    effect(() => {
      if (!this.isBrowser || !this.sidebarOpen() || this.drawerView() !== 'manual') return;
      setTimeout(() => this.focusFirstDrawerControl());
    });
  }

  private focusFirstDrawerControl(): void {
    const selector = this.drawerView() === 'manual' ? '#guest-first-name' : '.guests__drawer-option';
    (this.host.nativeElement.querySelector(selector) as HTMLElement | null)?.focus();
  }

  private loadGuests(): void {
    this.loadError.set(false);
    this.guestSvc.list().subscribe({
      next: (list) => {
        this.guests.set(list);
        this.loaded.set(true);
      },
      error: () => this.loadError.set(true),
    });
  }

  protected retryLoad(): void {
    this.loadGuests();
  }

  protected fullName(guest: Guest): string {
    return [guest.firstName, guest.lastName].filter((p) => p && p.trim()).join(' ');
  }

  /** Template-safe read of a named form control's trimmed value (`form.elements.
   *  namedItem()` is typed as a plain Element under strictTemplates, which has no
   *  `.value`) — also backs the inline required/format error display. */
  protected fieldValue(form: HTMLFormElement, name: string): string {
    const el = form.elements.namedItem(name);
    return el instanceof HTMLInputElement ? el.value.trim() : '';
  }

  protected fieldEmpty(form: HTMLFormElement, name: string): boolean {
    return !this.fieldValue(form, name);
  }

  protected emailValid(value: string): boolean {
    return !value || EMAIL_RE.test(value);
  }

  protected phoneValid(value: string): boolean {
    return !value || PHONE_RE.test(value);
  }

  // ---- "how do you want to add guests" sidebar ----

  protected openSidebar(event: Event): void {
    this.sidebarTrigger = event.currentTarget as HTMLElement;
    this.drawerView.set('choose');
    this.sidebarOpen.set(true);
  }

  protected closeSidebar(): void {
    this.sidebarOpen.set(false);
    this.drawerView.set('choose');
    this.resetGuestFormState();
  }

  protected onDrawerBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closeSidebar();
  }

  protected onDrawerKeydown(event: KeyboardEvent): void {
    trapTabKey(event.currentTarget as HTMLElement, event);
  }

  protected chooseManual(): void {
    this.drawerView.set('manual');
  }

  protected backToChoose(): void {
    // Edit mode never went through the chooser, so there's nothing to go "back"
    // to — treat it as cancelling the edit instead.
    if (this.isEditing()) {
      this.closeSidebar();
      return;
    }
    this.resetGuestFormState();
    this.drawerView.set('choose');
  }

  /** The sidebar's "Upload spreadsheet" option — forwards the click to the hidden file input. */
  protected chooseUpload(fileInput: HTMLInputElement): void {
    this.sidebarOpen.set(false);
    fileInput.click();
  }

  // ---- manual add / edit form ----

  protected togglePlusOne(): void {
    this.hasPlusOne.update((v) => !v);
    this.plusOneNameUnknown.set(false);
  }

  protected toggleChild(): void {
    this.hasChild.update((v) => !v);
    this.childNameUnknown.set(false);
  }

  private resetGuestFormState(): void {
    this.hasPlusOne.set(false);
    this.plusOneNameUnknown.set(false);
    this.hasChild.set(false);
    this.childNameUnknown.set(false);
    this.guestFormAttempted.set(false);
    this.editingGuestId.set(null);
  }

  /** Edit icon on a row: opens the manual form directly (no chooser step),
   *  pre-filled with that guest's current data. */
  protected startEdit(guest: Guest, event: Event): void {
    this.sidebarTrigger = event.currentTarget as HTMLElement;
    this.editingGuestId.set(guest.id);
    this.hasPlusOne.set(guest.hasPlusOne);
    this.plusOneNameUnknown.set(guest.plusOneNameUnknown);
    this.hasChild.set(guest.hasChild);
    this.childNameUnknown.set(guest.childNameUnknown);
    this.drawerView.set('manual');
    this.sidebarOpen.set(true);
    if (this.isBrowser) setTimeout(() => this.populateEditForm(guest));
  }

  private populateEditForm(guest: Guest): void {
    const form = this.host.nativeElement.querySelector('form.gform') as HTMLFormElement | null;
    if (!form) return;
    const set = (name: string, value: string) => {
      const el = form.elements.namedItem(name);
      if (el instanceof HTMLInputElement) el.value = value;
    };
    set('firstName', guest.firstName);
    set('lastName', guest.lastName ?? '');
    set('email', guest.email ?? '');
    set('phone', guest.phone ?? '');
    if (guest.hasPlusOne && !guest.plusOneNameUnknown) {
      set('plusOneFirstName', guest.plusOneFirstName ?? '');
      set('plusOneLastName', guest.plusOneLastName ?? '');
    }
    if (guest.hasChild && !guest.childNameUnknown) {
      set('childFirstName', guest.childFirstName ?? '');
      set('childLastName', guest.childLastName ?? '');
    }
    const relSelect = form.elements.namedItem('relationship');
    if (relSelect instanceof HTMLSelectElement) relSelect.value = guest.relationship;
    const invitedInput = form.querySelector(
      `input[name="invitedStatus"][value="${guest.invitedStatus}"]`,
    ) as HTMLInputElement | null;
    if (invitedInput) invitedInput.checked = true;
  }

  protected submitGuest(form: HTMLFormElement): void {
    const val = (name: string) => this.fieldValue(form, name);

    const firstName = val('firstName');
    const lastName = val('lastName');
    const email = val('email');
    const phone = val('phone');
    const plusOneOk = !this.hasPlusOne() || this.plusOneNameUnknown() || (val('plusOneFirstName') && val('plusOneLastName'));
    const childOk = !this.hasChild() || this.childNameUnknown() || (val('childFirstName') && val('childLastName'));
    const emailOk = this.emailValid(email);
    const phoneOk = this.phoneValid(phone);

    if (!firstName || !lastName || !plusOneOk || !childOk || !emailOk || !phoneOk) {
      this.guestFormAttempted.set(true);
      (form.querySelector('.ng-invalid, [data-invalid="true"]') as HTMLElement | null)?.focus();
      return;
    }

    const relationship = (form.elements.namedItem('relationship') as HTMLSelectElement | null)?.value as
      | GuestRelationship
      | undefined;
    const invitedInput = form.querySelector('input[name="invitedStatus"]:checked') as HTMLInputElement | null;

    const payload: GuestFormValues = {
      firstName,
      lastName: lastName || null,
      email: email || null,
      phone: phone || null,
      relationship: relationship ?? 'none',
      invitedStatus: (invitedInput?.value as GuestInvitedStatus | undefined) ?? 'definitely',
      hasPlusOne: this.hasPlusOne(),
      plusOneFirstName: this.hasPlusOne() && !this.plusOneNameUnknown() ? val('plusOneFirstName') : null,
      plusOneLastName: this.hasPlusOne() && !this.plusOneNameUnknown() ? val('plusOneLastName') : null,
      plusOneNameUnknown: this.hasPlusOne() && this.plusOneNameUnknown(),
      hasChild: this.hasChild(),
      childFirstName: this.hasChild() && !this.childNameUnknown() ? val('childFirstName') : null,
      childLastName: this.hasChild() && !this.childNameUnknown() ? val('childLastName') : null,
      childNameUnknown: this.hasChild() && this.childNameUnknown(),
    };

    const editId = this.editingGuestId();
    this.savingGuest.set(true);

    if (editId != null) {
      this.guestSvc.update(editId, payload).subscribe({
        next: () => {
          const sortOrder = this.guests().find((g) => g.id === editId)?.sortOrder ?? 0;
          const updated: Guest = { id: editId, sortOrder, ...payload };
          this.guests.update((list) => list.map((g) => (g.id === editId ? updated : g)));
          this.savingGuest.set(false);
          this.toast.success('guestListPage.guestUpdated');
          this.closeSidebar();
        },
        error: () => {
          this.savingGuest.set(false);
          this.toast.error('guestListPage.saveError');
        },
      });
      return;
    }

    this.guestSvc.add(payload).subscribe({
      next: (guest) => {
        this.guests.update((list) => [...list, guest]);
        this.savingGuest.set(false);
        this.toast.success('guestListPage.guestAdded');
        form.reset();
        this.resetGuestFormState();
        setTimeout(() => (form.elements.namedItem('firstName') as HTMLElement | null)?.focus());
      },
      error: () => {
        this.savingGuest.set(false);
        this.toast.error('guestListPage.saveError');
      },
    });
  }

  /** Invited-status radios in the table are editable inline — full payload
   *  replace, same as any other edit, just triggered from the row itself. */
  protected setInvited(guest: Guest, status: GuestInvitedStatus): void {
    if (guest.invitedStatus === status) return;
    const payload: GuestFormValues = { ...guest, invitedStatus: status };
    this.guestSvc.update(guest.id, payload).subscribe({
      next: () =>
        this.guests.update((list) => list.map((g) => (g.id === guest.id ? { ...g, invitedStatus: status } : g))),
      error: () => this.toast.error('guestListPage.saveError'),
    });
  }

  protected askRemove(guest: Guest): void {
    void this.confirmSvc
      .confirm({
        title: 'guestListPage.deleteTitle',
        detail: this.fullName(guest),
        confirmLabel: 'guestListPage.delete',
        danger: true,
      })
      .then((ok) => {
        if (!ok) return;
        this.guestSvc.remove(guest.id).subscribe({
          next: () => {
            this.guests.update((list) => list.filter((g) => g.id !== guest.id));
            this.selectedIds.update((set) => {
              if (!set.has(guest.id)) return set;
              const next = new Set(set);
              next.delete(guest.id);
              return next;
            });
          },
          error: () => this.toast.error('guestListPage.saveError'),
        });
      });
  }

  // ---- spreadsheet import (CSV/plain text — one name per line, or first column) ----

  protected onSpreadsheetFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = ''; // let the same file be re-picked later (e.g. after fixing it)
    if (!file) return;

    if (!/\.(csv|txt)$/i.test(file.name)) {
      this.toast.error('guestListPage.importUnsupported');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const names = this.parseNames(String(reader.result ?? ''));
      if (names.length === 0) {
        this.toast.error('guestListPage.importEmpty');
        return;
      }
      this.importNames(names);
    };
    reader.onerror = () => this.toast.error('guestListPage.importFailed');
    reader.readAsText(file);
  }

  /** One name per line; a "Name" header or a trailing comma-separated column (e.g.
   *  from a two-column export) is tolerated — only the first field is used. */
  private parseNames(text: string): string[] {
    return text
      .split(/\r?\n/)
      .map((line) => line.split(',')[0]?.trim() ?? '')
      .filter((name) => name.length > 0 && !/^(name|guest|guests?)$/i.test(name));
  }

  private importNames(names: string[]): void {
    this.importing.set(true);
    let failed = 0;
    from(names)
      .pipe(
        concatMap((name) => {
          const parts = name.split(/\s+/).filter(Boolean);
          const payload: GuestPayload = {
            firstName: parts[0] ?? name,
            lastName: parts.slice(1).join(' ') || null,
          };
          return this.guestSvc.add(payload).pipe(
            catchError(() => {
              failed++;
              return of(null);
            }),
          );
        }),
      )
      .subscribe({
        next: (guest) => {
          if (guest) this.guests.update((list) => [...list, guest]);
        },
        complete: () => {
          this.importing.set(false);
          if (failed === names.length) this.toast.error('guestListPage.saveError');
          else this.toast.success('guestListPage.importDone');
        },
      });
  }
}
