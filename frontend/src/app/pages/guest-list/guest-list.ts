import { Component, DestroyRef, ElementRef, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { DOCUMENT, NgTemplateOutlet, isPlatformBrowser } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, concatMap, from, of } from 'rxjs';

import { trapTabKey } from '../../core/a11y';
import { AuthService } from '../../core/auth.service';
import { CoupleProfile, CoupleService } from '../../core/couple.service';
import { formatDate } from '../../core/dates';
import {
  ATTENDANCES,
  Guest,
  GuestAttendance,
  GuestFamily,
  GuestInvitedStatus,
  GuestPayload,
  GuestRelationship,
  GuestService,
  partySize,
} from '../../core/guest.service';
import { SeatAssignment, SeatingService, SeatingTable } from '../../core/seating.service';
import { ConfirmService } from '../../core/confirm.service';
import { ToastService } from '../../core/toast.service';
import { FeatureLanding } from '../../components/feature-landing/feature-landing';

interface RelationshipOption {
  value: GuestRelationship;
  key: string;
  params?: Record<string, string>;
}

/** Everything the manual-entry form captures for one guest, minus server-assigned fields (order,
 * invitation replies). */
type GuestFormValues = Omit<Guest, 'id' | 'sortOrder' | 'rsvpAt' | 'rsvpMessage' | 'rsvpAnswer'>;

// Simple, permissive formats — this is a guest list, not a billing form: "needs an @
// and a domain" / "digits only (an optional leading +)" is the bar, not RFC 5322.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?\d+$/;

/** Quick picks for dietary needs (i18n keys under guestListPage.diet); anything else can be typed. */
/** Food quick picks: the RSVP options (PROPOSALS P10), so the couple's notes and the guests'
 * answers use the same words. Allergy asks for the details after it. */
const DIETS = ['vegetarian', 'vegan', 'fasting', 'kids', 'allergy'];

/** The family select's "new family…" option. */
const NEW_FAMILY = '__new';

/** The update payload for a row. It carries the `rsvpAt` the list last saw, so the server can tell
 * that the guest has answered on the invitation since and keep their answer. */
function updatePayload(g: Guest): GuestPayload {
  const { id: _id, sortOrder: _sortOrder, rsvpMessage: _rsvpMessage, rsvpAnswer: _rsvpAnswer, ...payload } = g;
  return payload;
}

/**
 * Couple guest list. Deliberately starts empty (no seeding, unlike the checklist/
 * budget) — the "start building your list" prompt is the first thing a couple sees.
 * B5: guests grouped by family (D9), whether they're coming, dietary needs, and the table
 * each party sits at (picked here, or on the seating chart; both stay in step).
 */
@Component({
  selector: 'app-guest-list',
  imports: [NgTemplateOutlet, RouterLink, TranslatePipe, FeatureLanding],
  templateUrl: './guest-list.html',
  styleUrl: './guest-list.scss',
  host: { class: 'theme-brand', '(document:keydown.escape)': 'closeSidebar()' },
})
export class GuestList {
  private readonly auth = inject(AuthService);
  private readonly guestSvc = inject(GuestService);
  private readonly seatingSvc = inject(SeatingService);
  private readonly coupleSvc = inject(CoupleService);
  private readonly confirmSvc = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly t = inject(TranslateService);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly doc = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly isCouple = this.auth.isCouple;

  /** "Next step" cards on the public landing. */
  protected readonly landingNext = [
    { key: 'nextSeating', link: '/seating' },
    { key: 'nextBudget', link: '/budget' },
  ];

  /** Static rows for the public landing's table preview (i18n keys, not data). */
  protected readonly previewRows: ReadonlyArray<{
    name: string;
    sub?: string;
    count: number;
    maybe?: boolean;
  }> = [
    { name: 'guestListPage.landing.preview1Name', sub: 'guestListPage.landing.preview1Sub', count: 2 },
    { name: 'guestListPage.landing.preview2Name', sub: 'guestListPage.landing.preview2Sub', count: 4 },
    { name: 'guestListPage.landing.preview3Name', sub: 'guestListPage.landing.preview3Sub', count: 1, maybe: true },
    { name: 'guestListPage.landing.preview4Name', sub: 'guestListPage.landing.preview4Sub', count: 2 },
  ];
  private coupleLoadStarted = false;

  protected readonly guests = signal<Guest[]>([]);
  protected readonly loaded = signal(false);
  protected readonly loadError = signal(false);
  protected readonly importing = signal(false);
  protected readonly couple = signal<CoupleProfile | null>(null);

  // ---- B5: families, attendance, dietary needs, tables ----
  protected readonly families = signal<GuestFamily[]>([]);
  protected readonly tables = signal<SeatingTable[]>([]);
  protected readonly assignments = signal<SeatAssignment[]>([]);
  protected readonly attendances = ATTENDANCES;
  protected readonly diets = DIETS;
  protected readonly newFamilyValue = NEW_FAMILY;
  protected readonly filter = signal<'all' | GuestAttendance>('all');
  /** The bulk bar's "new family" name field is open. */
  protected readonly bulkNewFamily = signal(false);
  /** The form's family select is on "new family…". */
  protected readonly formNewFamily = signal(false);
  protected readonly renamingFamilyId = signal<number | null>(null);

  /** Families (by name) with their guests, then the guests in no family; the filter applies. */
  protected readonly groups = computed(() => {
    const f = this.filter();
    const shown = this.guests().filter((g) => f === 'all' || g.attendance === f);
    const ids = new Set(this.families().map((fm) => fm.id));
    return {
      families: this.families()
        .map((family) => ({ family, guests: shown.filter((g) => g.familyId === family.id) }))
        .filter((x) => x.guests.length > 0 || f === 'all'),
      loose: shown.filter((g) => g.familyId === null || !ids.has(g.familyId)),
    };
  });
  // ---- row selection (header "select all" + per-row checkboxes) ----
  protected readonly selectedIds = signal<Set<number>>(new Set());
  /** The guests on screen under the current filter: "select all" means these, not the hidden ones. */
  private readonly shownIds = computed(() => {
    const groups = this.groups();
    return [...groups.families.flatMap((x) => x.guests), ...groups.loose].map((g) => g.id);
  });
  protected readonly allSelected = computed(() => {
    const ids = this.shownIds();
    return ids.length > 0 && ids.every((id) => this.selectedIds().has(id));
  });
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

  protected clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  protected contactLine(guest: Guest): string {
    return [guest.phone, guest.email].filter((x): x is string => !!x).join(' · ');
  }

  protected toggleSelectAll(): void {
    this.selectedIds.set(this.allSelected() ? new Set() : new Set(this.shownIds()));
  }

  /** A new filter starts with nothing selected: a guest it hides must not get the bulk action. */
  protected setFilter(filter: 'all' | GuestAttendance): void {
    this.filter.set(filter);
    this.clearSelection();
  }

  protected partySize(guest: Guest): number {
    return partySize(guest);
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
  /** People coming / not answered yet / not coming (headcounts, like the totals above). */
  protected readonly attendanceCount = computed(() => {
    const by: Record<GuestAttendance, number> = { yes: 0, pending: 0, no: 0 };
    for (const g of this.guests()) by[g.attendance] += this.partySize(g);
    return by;
  });
  /** Parties with a dietary need written down. */
  protected readonly dietaryCount = computed(() => this.guests().filter((g) => !!g.dietaryNeeds).length);

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
      this.guestSvc.families().subscribe({ next: (list) => this.families.set(list), error: () => {} });
      this.loadSeating();
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

    // Leaving the page with the drawer open (browser Back) must not leave the next page locked.
    inject(DestroyRef).onDestroy(() => {
      if (this.isBrowser && this.sidebarOpen()) this.doc.body.style.overflow = '';
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

  private loadSeating(): void {
    this.seatingSvc.load().subscribe({
      next: (state) => {
        this.tables.set(state.tables);
        this.assignments.set(state.assignments);
      },
      error: () => {},
    });
  }

  // ---- attendance (inline) ----

  protected setAttendance(guest: Guest, select: HTMLSelectElement): void {
    const attendance = select.value as GuestAttendance;
    if (guest.attendance === attendance) return;
    const sent: Guest = { ...guest, attendance };
    this.guestSvc.update(guest.id, updatePayload(sent)).subscribe({
      next: (saved) => {
        // The server may have kept the guest's own answer; the select shows what was stored.
        select.value = this.rowSaved(saved, sent).attendance;
      },
      error: () => {
        // The select moved itself; the binding didn't change, so put it back by hand.
        select.value = guest.attendance;
        this.toast.error('guestListPage.saveError');
      },
    });
  }

  /** After an update: the list takes the server's row (it keeps a guest's newer answer on the
   * invitation over what we sent), or what we sent when the server gave none back. */
  private rowSaved(saved: Guest | null, sent: Guest): Guest {
    const row = saved ?? sent;
    this.guests.update((list) => list.map((g) => (g.id === row.id ? row : g)));
    // The server freed seats that no longer belong (declined, plus-one or child removed).
    this.assignments.update((list) =>
      list.filter(
        (a) =>
          a.guestId !== row.id ||
          (row.attendance !== 'no' &&
            (a.attendeeKind !== 'plus_one' || row.hasPlusOne) &&
            (a.attendeeKind !== 'child' || row.hasChild)),
      ),
    );
    // A row the filter now hides can't stay selected for the bulk action.
    const f = this.filter();
    if (f !== 'all' && row.attendance !== f && this.selectedIds().has(row.id)) this.toggleSelect(row.id);
    return row;
  }

  // ---- tables: which one a party sits at, chosen from the list ----

  protected tableOf(guest: Guest): SeatingTable | null {
    const seat = this.assignments().find((a) => a.guestId === guest.id && a.attendeeKind === 'primary')
      ?? this.assignments().find((a) => a.guestId === guest.id);
    return seat ? (this.tables().find((t) => t.id === seat.tableId) ?? null) : null;
  }

  protected freeSeats(table: SeatingTable): number {
    return table.seatCount - this.assignments().filter((a) => a.tableId === table.id).length;
  }

  /** The party fits at this table (counting the seats it already holds there). */
  protected fits(guest: Guest, table: SeatingTable): boolean {
    const already = this.assignments().filter((a) => a.guestId === guest.id && a.tableId === table.id).length;
    return this.freeSeats(table) + already >= this.partySize(guest);
  }

  protected seatAt(guest: Guest, select: HTMLSelectElement): void {
    const tableId = select.value ? Number(select.value) : null;
    this.seatingSvc.seatGuest(guest.id, tableId).subscribe({
      next: (seats) =>
        this.assignments.update((list) => [...list.filter((a) => a.guestId !== guest.id), ...seats]),
      error: (err: { status?: number }) => {
        this.toast.error(err?.status === 409 ? 'guestListPage.tableFull' : 'guestListPage.saveError');
        // The select moved itself; the binding didn't change, so put it back to where they sit by hand.
        select.value = String(this.tableOf(guest)?.id ?? '');
        this.loadSeating(); // the free seats it shows were out of date
      },
    });
  }

  // ---- families (D9) ----

  protected familyName(id: number | null): string | null {
    return id === null ? null : (this.families().find((f) => f.id === id)?.name ?? null);
  }

  protected familyHeadcount(guests: Guest[]): number {
    return guests.reduce((sum, g) => sum + this.partySize(g), 0);
  }

  /** Bulk bar: put the selected guests into a family (or "new family…" opens the name field). */
  protected bulkSetFamily(select: HTMLSelectElement): void {
    const value = select.value;
    select.value = '';
    if (!value) return;
    if (value === NEW_FAMILY) {
      this.bulkNewFamily.set(true);
      setTimeout(() => (this.host.nativeElement.querySelector('#bulk-family-name') as HTMLInputElement | null)?.focus());
      return;
    }
    this.assignFamily([...this.selectedIds()], Number(value));
  }

  protected bulkCreateFamily(input: HTMLInputElement): void {
    const name = input.value.trim();
    if (!name) {
      input.focus();
      return;
    }
    this.guestSvc.addFamily(name).subscribe({
      next: (family) => {
        this.families.update((list) => [...list, family].sort((a, b) => a.name.localeCompare(b.name)));
        this.bulkNewFamily.set(false);
        this.assignFamily([...this.selectedIds()], family.id);
      },
      error: () => this.toast.error('guestListPage.saveError'),
    });
  }

  protected bulkRemoveFamily(): void {
    this.assignFamily([...this.selectedIds()], null);
  }

  private assignFamily(ids: number[], familyId: number | null): void {
    if (ids.length === 0) return;
    this.guestSvc.setFamily(ids, familyId).subscribe({
      next: () => {
        this.guests.update((list) => list.map((g) => (ids.includes(g.id) ? { ...g, familyId } : g)));
        this.selectedIds.set(new Set());
        this.toast.success(familyId === null ? 'guestListPage.familyLeft' : 'guestListPage.familyJoined');
      },
      error: () => this.toast.error('guestListPage.saveError'),
    });
  }

  protected startRenameFamily(family: GuestFamily): void {
    this.renamingFamilyId.set(family.id);
    setTimeout(() => (this.host.nativeElement.querySelector('.gfam__rename') as HTMLInputElement | null)?.select());
  }

  protected commitRenameFamily(family: GuestFamily, event: Event): void {
    const name = (event.target as HTMLInputElement).value.trim();
    this.renamingFamilyId.set(null);
    if (!name || name === family.name) return;
    this.guestSvc.renameFamily(family.id, name).subscribe({
      next: (saved) => this.families.update((list) => list.map((f) => (f.id === saved.id ? saved : f))),
      error: () => this.toast.error('guestListPage.saveError'),
    });
  }

  protected askRemoveFamily(family: GuestFamily): void {
    void this.confirmSvc
      .confirm({
        title: 'guestListPage.familyDeleteTitle',
        detail: family.name,
        body: 'guestListPage.familyDeleteBody',
        confirmLabel: 'guestListPage.delete',
        danger: true,
      })
      .then((ok) => {
        if (!ok) return;
        this.guestSvc.removeFamily(family.id).subscribe({
          next: () => {
            this.families.update((list) => list.filter((f) => f.id !== family.id));
            this.guests.update((list) => list.map((g) => (g.familyId === family.id ? { ...g, familyId: null } : g)));
          },
          error: () => this.toast.error('guestListPage.saveError'),
        });
      });
  }

  /** The form's family select: "new family…" shows the name field. */
  protected onFormFamily(select: HTMLSelectElement): void {
    this.formNewFamily.set(select.value === NEW_FAMILY);
    if (select.value === NEW_FAMILY) {
      setTimeout(() => (this.host.nativeElement.querySelector('#guest-new-family') as HTMLInputElement | null)?.focus());
    }
  }

  /** "vegetarian" chip in the form: appends to the dietary field; "allergy" adds "allergy: " and
   * leaves the cursor there for the details. */
  protected addDiet(input: HTMLInputElement, key: string): void {
    const word = this.t.instant('guestListPage.diet.' + key) as string;
    const parts = input.value.split(',').map((x) => x.trim()).filter(Boolean);
    const has = parts.some((p) => p.toLocaleLowerCase().startsWith(word.toLocaleLowerCase()));
    if (!has) parts.push(key === 'allergy' ? `${word}: ` : word);
    input.value = parts.join(', ');
    if (key === 'allergy') {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }

  /** "12 ოქტ. 2026" for when a party answered on the invitation. */
  protected replyDate(iso: string): string {
    return formatDate(iso, this.t.currentLang ?? 'ka', 'medium');
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
    this.formNewFamily.set(false);
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
    const attendanceInput = form.querySelector(
      `input[name="attendance"][value="${guest.attendance}"]`,
    ) as HTMLInputElement | null;
    if (attendanceInput) attendanceInput.checked = true;
    set('dietaryNeeds', guest.dietaryNeeds ?? '');
    const familySelect = form.elements.namedItem('familyId');
    if (familySelect instanceof HTMLSelectElement) familySelect.value = guest.familyId === null ? '' : String(guest.familyId);
  }

  protected submitGuest(form: HTMLFormElement): void {
    const val = (name: string) => this.fieldValue(form, name);

    const firstName = val('firstName');
    const lastName = val('lastName');
    const email = val('email');
    const phone = val('phone');
    // Only first names are required: a plus-one, a child or an imported guest may have one name.
    const plusOneOk = !this.hasPlusOne() || this.plusOneNameUnknown() || !!val('plusOneFirstName');
    const childOk = !this.hasChild() || this.childNameUnknown() || !!val('childFirstName');
    const emailOk = this.emailValid(email);
    const phoneOk = this.phoneValid(phone);

    if (!firstName || !plusOneOk || !childOk || !emailOk || !phoneOk) {
      this.guestFormAttempted.set(true);
      (form.querySelector('.ng-invalid, [data-invalid="true"]') as HTMLElement | null)?.focus();
      return;
    }

    const relationship = (form.elements.namedItem('relationship') as HTMLSelectElement | null)?.value as
      | GuestRelationship
      | undefined;
    const invitedInput = form.querySelector('input[name="invitedStatus"]:checked') as HTMLInputElement | null;
    const attendanceInput = form.querySelector('input[name="attendance"]:checked') as HTMLInputElement | null;
    const familyValue = (form.elements.namedItem('familyId') as HTMLSelectElement | null)?.value ?? '';
    const newFamilyName = val('newFamily');
    if (familyValue === NEW_FAMILY && !newFamilyName) {
      this.guestFormAttempted.set(true);
      (form.elements.namedItem('newFamily') as HTMLElement | null)?.focus();
      return;
    }

    const payload: GuestFormValues = {
      firstName,
      lastName: lastName || null,
      email: email || null,
      phone: phone || null,
      relationship: relationship ?? 'none',
      invitedStatus: (invitedInput?.value as GuestInvitedStatus | undefined) ?? 'definitely',
      hasPlusOne: this.hasPlusOne(),
      plusOneFirstName: this.hasPlusOne() && !this.plusOneNameUnknown() ? val('plusOneFirstName') : null,
      plusOneLastName: this.hasPlusOne() && !this.plusOneNameUnknown() ? val('plusOneLastName') || null : null,
      plusOneNameUnknown: this.hasPlusOne() && this.plusOneNameUnknown(),
      hasChild: this.hasChild(),
      childFirstName: this.hasChild() && !this.childNameUnknown() ? val('childFirstName') : null,
      childLastName: this.hasChild() && !this.childNameUnknown() ? val('childLastName') || null : null,
      childNameUnknown: this.hasChild() && this.childNameUnknown(),
      attendance: (attendanceInput?.value as GuestAttendance | undefined) ?? 'pending',
      dietaryNeeds: val('dietaryNeeds') || null,
      familyId: familyValue && familyValue !== NEW_FAMILY ? Number(familyValue) : null,
    };

    // A new family named in the form is created first, then the guest saved into it.
    if (familyValue === NEW_FAMILY) {
      this.savingGuest.set(true);
      this.guestSvc.addFamily(newFamilyName).subscribe({
        next: (family) => {
          this.families.update((list) => [...list, family].sort((a, b) => a.name.localeCompare(b.name)));
          this.savingGuest.set(false);
          this.saveGuest(form, { ...payload, familyId: family.id });
        },
        error: () => {
          this.savingGuest.set(false);
          this.toast.error('guestListPage.saveError');
        },
      });
      return;
    }
    this.saveGuest(form, payload);
  }

  private saveGuest(form: HTMLFormElement, payload: GuestFormValues): void {
    const editId = this.editingGuestId();
    this.savingGuest.set(true);

    if (editId != null) {
      // Order and invitation replies are the server's; send back what the list has.
      const before = this.guests().find((g) => g.id === editId);
      const sent: Guest = {
        id: editId,
        sortOrder: before?.sortOrder ?? 0,
        rsvpAt: before?.rsvpAt ?? null,
        rsvpMessage: before?.rsvpMessage ?? null,
        rsvpAnswer: before?.rsvpAnswer ?? null,
        ...payload,
      };
      this.guestSvc.update(editId, updatePayload(sent)).subscribe({
        next: (saved) => {
          this.rowSaved(saved, sent);
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
    const sent: Guest = { ...guest, invitedStatus: status };
    this.guestSvc.update(guest.id, updatePayload(sent)).subscribe({
      next: (saved) => this.rowSaved(saved, sent),
      error: () => {
        // The radio moved itself; the binding didn't change, so put the pair back by hand.
        const radios = this.host.nativeElement.querySelectorAll(`input[name="invited-${guest.id}"]`);
        for (const radio of radios as NodeListOf<HTMLInputElement>) radio.checked = radio.value === guest.invitedStatus;
        this.toast.error('guestListPage.saveError');
      },
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
            this.assignments.update((list) => list.filter((a) => a.guestId !== guest.id));
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

  /** One person per line, or a spreadsheet export with commas, semicolons or tabs. A header row is
   *  recognised and skipped, and says which columns hold the names. Without one, the second column
   *  counts as the surname only if it looks like a name (not a phone number or an email). */
  private parseNames(text: string): string[] {
    const rows = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!rows.length) return [];
    const delim = [';', '\t', ','].find((d) => rows[0].includes(d));
    const cells = (line: string) => (delim ? line.split(delim) : [line]).map((c) => c.trim().replace(/^"|"$/g, ''));
    const FIRST = /^(first ?name|given name|name|guest|guests|სახელი|სტუმარი|სტუმრები)$/i;
    const LAST = /^(last ?name|surname|family name|გვარი)$/i;
    const head = cells(rows[0]);
    const hasHeader = head.some((h) => FIRST.test(h) || LAST.test(h));
    const firstAt = hasHeader ? Math.max(0, head.findIndex((h) => FIRST.test(h))) : 0;
    const lastAt = hasHeader ? head.findIndex((h) => LAST.test(h)) : -1;
    return rows
      .slice(hasHeader ? 1 : 0)
      .map((row) => {
        const c = cells(row);
        const surname = hasHeader ? (lastAt >= 0 ? c[lastAt] : '') : /^[\p{L}' -]+$/u.test(c[1] ?? '') ? c[1] : '';
        return [c[firstAt], surname].filter(Boolean).join(' ');
      })
      .filter((name) => name.length > 0);
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
