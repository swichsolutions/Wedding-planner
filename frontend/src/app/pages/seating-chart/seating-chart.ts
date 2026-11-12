import { Component, DestroyRef, ElementRef, HostListener, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragEnd,
  CdkDragHandle,
  CdkDropList,
  CdkDropListGroup,
} from '@angular/cdk/drag-drop';

import { trapTabKey } from '../../core/a11y';
import { AuthService } from '../../core/auth.service';
import { Guest, GuestFamily, GuestService } from '../../core/guest.service';
import { LanguageService } from '../../i18n/language.service';
import {
  AttendeeKind,
  SeatAssignment,
  SeatingObject,
  SeatingObjectPayload,
  SeatingObjectType,
  SeatingService,
  SeatingState,
  SeatingTable,
  SeatingTablePayload,
  TableShape,
  VenuePlan,
  fourSidedSides,
  objectPayload,
  tablePayload,
} from '../../core/seating.service';
import { ConfirmService } from '../../core/confirm.service';
import { FLOOR_PLAN_ACCEPT, FloorPlanError, prepareFloorPlan } from '../../core/floor-plan-file';
import { ToastService } from '../../core/toast.service';
import { FeatureLanding } from '../../components/feature-landing/feature-landing';

interface Attendee {
  guestId: number;
  kind: AttendeeKind;
  name: string;
  /** The party's dietary needs, if any (shown on the chip and in the printed list). */
  diet: string | null;
}

/** Width of the venue's floor plan on the canvas, so tables line up with it on every screen. */
const PLAN_WIDTH = 1000;

interface TablePreset {
  key: string;
  shape: TableShape;
  seatCount: number;
}

const PRESETS: TablePreset[] = [
  { key: 'oneSided2', shape: 'one_sided', seatCount: 2 },
  { key: 'round8', shape: 'round', seatCount: 8 },
  { key: 'rect8', shape: 'rectangular', seatCount: 8 },
  { key: 'fourSided10', shape: 'four_sided', seatCount: 10 },
];

interface ObjectKindInfo {
  type: SeatingObjectType;
  i18nKey: string;
  width: number;
  height: number;
}

const OBJECT_CATALOG: ObjectKindInfo[] = [
  { type: 'dance_floor', i18nKey: 'danceFloor', width: 200, height: 200 },
  { type: 'dj_booth', i18nKey: 'djBooth', width: 90, height: 60 },
  { type: 'band', i18nKey: 'band', width: 140, height: 80 },
  { type: 'photo_booth', i18nKey: 'photoBooth', width: 70, height: 90 },
  { type: 'stage', i18nKey: 'stage', width: 200, height: 100 },
  { type: 'podium', i18nKey: 'podium', width: 40, height: 40 },
  { type: 'cake_table', i18nKey: 'cakeTable', width: 70, height: 70 },
  { type: 'gift_table', i18nKey: 'giftTable', width: 90, height: 60 },
  { type: 'buffet_table', i18nKey: 'buffetTable', width: 160, height: 60 },
  { type: 'bar', i18nKey: 'bar', width: 160, height: 60 },
  { type: 'entrance', i18nKey: 'entrance', width: 60, height: 20 },
  { type: 'door', i18nKey: 'door', width: 50, height: 16 },
];

const OBJECT_SECTIONS: { key: string; types: SeatingObjectType[] }[] = [
  { key: 'av', types: ['dance_floor', 'dj_booth', 'band', 'photo_booth', 'stage', 'podium'] },
  { key: 'event', types: ['cake_table', 'gift_table', 'buffet_table', 'bar'] },
  { key: 'doors', types: ['entrance', 'door'] },
];

/** Seat-index key for a "seat-<tableId>-<seatIndex>" CDK drop-list id. */
function seatListId(tableId: number, seatIndex: number): string {
  return `seat-${tableId}-${seatIndex}`;
}

function parseSeatListId(id: string): { tableId: number; seatIndex: number } | null {
  const m = /^seat-(\d+)-(\d+)$/.exec(id);
  return m ? { tableId: Number(m[1]), seatIndex: Number(m[2]) } : null;
}

/** iOS Safari draws nothing on a canvas above about 16.7 million pixels. */
const MAX_CANVAS_PIXELS = 16_000_000;

/** A spot on the canvas: nothing sits above or to the left of it, where it couldn't be reached. */
function onCanvas(pos: { x: number; y: number }): { x: number; y: number } {
  return { x: Math.max(0, pos.x), y: Math.max(0, pos.y) };
}

/**
 * Free-form seating chart: couples add tables (four quick presets or a custom
 * shape/seat-count), drag each table anywhere on the canvas to mirror their venue,
 * then drag guests from the unassigned pool onto individual seats. B5: tables and zones
 * turn, zones take a name and size, the venue's floor plan can sit underneath, the counts
 * (tables, seats, free seats, unseated) sit on top, and the plan downloads as an image, prints
 * as a list per table or goes out through the phone's share sheet. Guests who said no aren't
 * offered; families stay together in the pool.
 */
@Component({
  selector: 'app-seating-chart',
  imports: [TranslatePipe, CdkDropListGroup, CdkDropList, CdkDrag, CdkDragHandle, FeatureLanding],
  templateUrl: './seating-chart.html',
  styleUrl: './seating-chart.scss',
  host: { class: 'theme-brand' },
})
export class SeatingChart {
  private readonly auth = inject(AuthService);
  private readonly guestSvc = inject(GuestService);
  private readonly seatingSvc = inject(SeatingService);
  private readonly confirmSvc = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly t = inject(TranslateService);
  private readonly lang = inject(LanguageService);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly isCouple = this.auth.isCouple;

  // ---- public landing (not signed in) ----
  protected readonly landingNext = [
    { key: 'nextGuests', link: '/guests' },
    { key: 'nextBudget', link: '/budget' },
  ];
  /** Static tables for the landing's canvas preview: % position, seats, how many taken. */
  protected readonly previewTables = [
    { n: 1, x: 6, y: 44, seats: 8, seated: 8 },
    { n: 2, x: 36, y: 36, seats: 10, seated: 7, active: true },
    { n: 3, x: 66, y: 34, seats: 8, seated: 5 },
  ];
  protected seatIdx(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }
  private loadStarted = false;

  protected readonly loaded = signal(false);
  protected readonly loadError = signal(false);
  protected readonly guests = signal<Guest[]>([]);
  protected readonly tables = signal<SeatingTable[]>([]);
  protected readonly assignments = signal<SeatAssignment[]>([]);
  protected readonly objects = signal<SeatingObject[]>([]);
  protected readonly families = signal<GuestFamily[]>([]);

  // ---- the venue's floor plan, under the chart ----
  protected readonly floorPlanUrl = signal<string | null>(null);
  protected readonly floorPlanVendorId = signal<number | null>(null);
  /** The couple's venue with a plan to offer (B5). */
  protected readonly venuePlan = signal<VenuePlan | null>(null);
  /** Offered until the chart holds that venue's plan. */
  protected readonly venueSuggestion = computed(() => {
    const venue = this.venuePlan();
    return venue && this.floorPlanVendorId() !== venue.vendorId ? venue : null;
  });
  protected readonly planAccept = FLOOR_PLAN_ACCEPT;
  protected readonly showPlan = signal(true);
  protected readonly planBusy = signal(false);
  protected readonly planWidth = PLAN_WIDTH;

  /** The phone's share sheet can take an image (hidden where it can't). */
  protected readonly canShare = signal(false);
  protected readonly exporting = signal(false);

  protected readonly presets = PRESETS;
  protected readonly objectSections = OBJECT_SECTIONS;

  // ---- add/edit side drawer (one entry point for both tables and venue items) ----
  protected readonly shapes: TableShape[] = ['round', 'one_sided', 'rectangular', 'four_sided'];
  protected readonly drawerOpen = signal(false);
  protected readonly modalStep = signal<'browse' | 'custom' | 'object'>('browse');
  protected readonly customShape = signal<TableShape>('round');
  protected readonly editingTable = signal<SeatingTable | null>(null);
  protected readonly editingObject = signal<SeatingObject | null>(null);
  private modalTrigger: HTMLElement | null = null;

  protected readonly renamingTableId = signal<number | null>(null);

  constructor() {
    inject(Title).setTitle(`${this.t.instant('seatingPage.title')} | ${this.t.instant('brand.name')}`);
    inject(Meta).updateTag({ name: 'description', content: this.t.instant('seatingPage.subtitle') });

    effect(() => {
      if (!this.isBrowser || !this.isCouple() || this.loadStarted) return;
      this.loadStarted = true;
      this.loadAll();
    });

    if (this.isBrowser) {
      try {
        const probe = new File([new Blob()], 'plan.png', { type: 'image/png' });
        this.canShare.set(typeof navigator.share === 'function' && !!navigator.canShare?.({ files: [probe] }));
      } catch {
        this.canShare.set(false);
      }
      // Leaving the page with the drawer open (browser Back) must not leave the next page locked.
      const body = this.host.nativeElement.ownerDocument.body;
      inject(DestroyRef).onDestroy(() => {
        if (this.drawerOpen()) body.style.overflow = '';
      });
    }
  }

  private loadAll(): void {
    this.loadError.set(false);
    this.guestSvc.list().subscribe({
      next: (list) => this.guests.set(list),
      error: () => this.loadError.set(true),
    });
    this.guestSvc.families().subscribe({ next: (list) => this.families.set(list), error: () => {} });
    this.seatingSvc.load().subscribe({
      next: (state) => {
        // A table or zone saved above or left of the canvas comes back to its edge.
        const back = <T extends { positionX: number; positionY: number }>(item: T): T =>
          item.positionX < 0 || item.positionY < 0
            ? { ...item, positionX: Math.max(0, item.positionX), positionY: Math.max(0, item.positionY) }
            : item;
        this.tables.set(state.tables.map(back));
        this.assignments.set(state.assignments);
        this.objects.set(state.objects.map(back));
        this.applyPlan(state);
        this.loaded.set(true);
      },
      error: () => {
        this.loadError.set(true);
        this.loaded.set(true);
      },
    });
  }

  protected retryLoad(): void {
    this.loaded.set(false);
    this.loadAll();
  }

  // ---- attendees derived from the guest list (primary / plus-one / child) ----

  private attendeesFor(guest: Guest): Attendee[] {
    const diet = guest.dietaryNeeds;
    const list: Attendee[] = [{ guestId: guest.id, kind: 'primary', name: [guest.firstName, guest.lastName].filter(Boolean).join(' '), diet }];
    if (guest.hasPlusOne) {
      const name = guest.plusOneNameUnknown
        ? this.t.instant('seatingPage.plusOneUnknown')
        : [guest.plusOneFirstName, guest.plusOneLastName].filter(Boolean).join(' ');
      list.push({ guestId: guest.id, kind: 'plus_one', name, diet });
    }
    if (guest.hasChild) {
      const name = guest.childNameUnknown
        ? this.t.instant('seatingPage.childUnknown')
        : [guest.childFirstName, guest.childLastName].filter(Boolean).join(' ');
      list.push({ guestId: guest.id, kind: 'child', name, diet });
    }
    return list;
  }

  /** Everyone who may still come: guests who said no aren't seated (their seats were freed). */
  protected readonly allAttendees = computed<Attendee[]>(() =>
    this.guests().filter((g) => g.attendance !== 'no').flatMap((g) => this.attendeesFor(g)),
  );

  private readonly assignedKeySet = computed(() => new Set(this.assignments().map((a) => `${a.guestId}:${a.attendeeKind}`)));

  protected readonly unassignedAttendees = computed(() =>
    this.allAttendees().filter((a) => !this.assignedKeySet().has(`${a.guestId}:${a.kind}`)),
  );

  protected readonly totalSeated = computed(() => this.assignments().length);

  /** The unseated, by family (families stay together), then everyone else. */
  protected readonly poolGroups = computed(() => {
    const left = this.unassignedAttendees();
    const familyOf = new Map(this.guests().map((g) => [g.id, g.familyId]));
    const groups = this.families()
      .map((f) => ({ key: 'f' + f.id, name: f.name as string | null, attendees: left.filter((a) => familyOf.get(a.guestId) === f.id) }))
      .filter((g) => g.attendees.length > 0);
    const known = new Set(this.families().map((f) => f.id));
    const rest = left.filter((a) => {
      const fid = familyOf.get(a.guestId);
      return fid == null || !known.has(fid);
    });
    if (rest.length) groups.push({ key: 'rest', name: null, attendees: rest });
    return groups;
  });

  // ---- counts (guide: tables, seats, free seats, unseated guests) ----
  protected readonly seatTotal = computed(() => this.tables().reduce((sum, t) => sum + t.seatCount, 0));
  protected readonly freeTotal = computed(() => Math.max(0, this.seatTotal() - this.assignments().length));

  // ---- table geometry (shared by the template for seat-dot placement) ----

  protected tableSize(table: SeatingTable): { width: number; height: number } {
    const n = table.seatCount;
    switch (table.shape) {
      case 'rectangular': {
        const base = 44 + n * 6;
        return { width: base * 1.6, height: base * 0.85 };
      }
      case 'one_sided':
        return { width: Math.max(120, 36 * n), height: 56 };
      case 'four_sided': {
        const base = 44 + n * 5;
        return { width: base * 1.5, height: base * 1.05 };
      }
      default: {
        const base = 44 + n * 6;
        return { width: base, height: base };
      }
    }
  }

  /** Seat position relative to the table's center, shape-aware: round tables ring
   * seats around an ellipse; one-sided tables line seats along the front edge;
   * rectangular (2-sided) tables split seats between the top and bottom edges;
   * four-sided tables walk seats around the full perimeter. */
  protected seatOffset(table: SeatingTable, seatIndex: number): { x: number; y: number } {
    const { width, height } = this.tableSize(table);
    const n = table.seatCount;
    const gap = 22;

    if (table.shape === 'one_sided') {
      const usable = width - 40;
      const x = n <= 1 ? 0 : -usable / 2 + (usable * seatIndex) / (n - 1);
      return { x, y: height / 2 + gap };
    }

    if (table.shape === 'rectangular') {
      const perSide = Math.ceil(n / 2);
      const onTop = seatIndex < perSide;
      const idx = onTop ? seatIndex : seatIndex - perSide;
      const count = onTop ? perSide : n - perSide;
      const usable = width - 40;
      const x = count <= 1 ? 0 : -usable / 2 + (usable * idx) / (count - 1);
      return { x, y: onTop ? -(height / 2 + gap) : height / 2 + gap };
    }

    if (table.shape === 'four_sided') {
      const perimeter = 2 * (width + height);
      let s = ((seatIndex + 0.5) * perimeter) / n;
      if (s < width) return { x: -width / 2 + s, y: -(height / 2 + gap) };
      s -= width;
      if (s < height) return { x: width / 2 + gap, y: -height / 2 + s };
      s -= height;
      if (s < width) return { x: width / 2 - s, y: height / 2 + gap };
      s -= width;
      return { x: -(width / 2 + gap), y: height / 2 - s };
    }

    // round
    const angle = (2 * Math.PI * seatIndex) / n - Math.PI / 2;
    const rx = width / 2 + gap;
    const ry = height / 2 + gap;
    return { x: Math.cos(angle) * rx, y: Math.sin(angle) * ry };
  }

  protected seatIndexes(table: SeatingTable): number[] {
    return Array.from({ length: table.seatCount }, (_, i) => i);
  }

  protected seatListId = seatListId;

  protected seatOccupant(tableId: number, seatIndex: number): SeatAssignment | undefined {
    return this.assignments().find((a) => a.tableId === tableId && a.seatIndex === seatIndex);
  }

  protected attendeeFor(assignment: SeatAssignment): Attendee | undefined {
    return this.allAttendees().find((a) => a.guestId === assignment.guestId && a.kind === assignment.attendeeKind);
  }

  // ---- adding tables ----

  private nextName(): string {
    return this.t.instant('seatingPage.tableDefaultName', { n: this.tables().length + 1 });
  }

  /** New items are laid out in a grid of 200px columns, wide enough to fit
   * whatever the canvas currently measures — so adding tables never pushes
   * one past the visible edge and forces a horizontal scrollbar. */
  private nextPosition(): { x: number; y: number } {
    const n = this.tables().length + this.objects().length;
    const wrapWidth = this.isBrowser
      ? this.host.nativeElement.querySelector('.seat-canvas-wrap')?.clientWidth
      : undefined;
    const cols = wrapWidth ? Math.max(1, Math.floor((wrapWidth - 80) / 200)) : 4;
    return { x: 80 + (n % cols) * 200, y: 80 + Math.floor(n / cols) * 220 };
  }

  private addTable(payload: SeatingTablePayload): void {
    this.seatingSvc.addTable(payload).subscribe({
      next: (table) => this.tables.update((list) => [...list, table]),
      error: () => this.toast.error('seatingPage.saveError'),
    });
  }

  /** Quick-add straight from the preset grid — no form, no extra click. */
  protected selectPreset(preset: TablePreset): void {
    const pos = this.nextPosition();
    this.addTable({ name: this.nextName(), shape: preset.shape, seatCount: preset.seatCount, positionX: pos.x, positionY: pos.y, rotation: 0 });
    this.closeModal();
  }

  /** Same table again, offset so it doesn't sit exactly on top of the original. */
  protected duplicateTable(table: SeatingTable): void {
    const pos = this.nextPosition();
    const name = `${table.name} ${this.t.instant('seatingPage.copySuffix')}`;
    this.addTable({ name, shape: table.shape, seatCount: table.seatCount, positionX: pos.x, positionY: pos.y, rotation: table.rotation });
  }

  // ---- add/edit side drawer ----

  protected openAddModal(): void {
    this.editingTable.set(null);
    this.editingObject.set(null);
    this.customShape.set('round');
    this.modalStep.set('browse');
    this.openModal();
  }

  protected openEditModal(table: SeatingTable): void {
    this.editingObject.set(null);
    this.editingTable.set(table);
    this.customShape.set(table.shape);
    this.modalStep.set('custom');
    this.openModal('#tm-name');
  }

  private openModal(focusSelector?: string): void {
    this.modalTrigger = this.isBrowser ? (document.activeElement as HTMLElement | null) : null;
    this.drawerOpen.set(true);
    if (!this.isBrowser) return;
    this.host.nativeElement.ownerDocument.body.style.overflow = 'hidden';
    setTimeout(() => {
      const card = this.host.nativeElement.querySelector('.add-drawer__panel');
      const el = (focusSelector && card?.querySelector(focusSelector)) || card?.querySelector('.add-drawer__close');
      (el as HTMLElement | null)?.focus();
    });
  }

  protected closeModal(): void {
    this.drawerOpen.set(false);
    if (this.isBrowser) this.host.nativeElement.ownerDocument.body.style.overflow = '';
    this.modalTrigger?.focus();
    this.modalTrigger = null;
  }

  protected onModalBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closeModal();
  }

  protected onModalKeydown(event: KeyboardEvent): void {
    trapTabKey(event.currentTarget as HTMLElement, event);
  }

  @HostListener('document:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (this.drawerOpen() && event.key === 'Escape') this.closeModal();
  }

  protected openCustomForm(): void {
    this.modalStep.set('custom');
    if (this.isBrowser) {
      setTimeout(() => (this.host.nativeElement.querySelector('#tm-name') as HTMLInputElement | null)?.focus());
    }
  }

  protected backToBrowse(): void {
    this.modalStep.set('browse');
  }

  /** Quick-add a venue item from the drawer — mirrors selectPreset for tables. */
  protected selectObject(type: SeatingObjectType): void {
    this.addObject(type);
    this.closeModal();
  }

  protected shapeLabelKey(shape: TableShape): string {
    switch (shape) {
      case 'round':
        return 'seatingPage.shapeRound';
      case 'rectangular':
        return 'seatingPage.shapeRectangular';
      case 'one_sided':
        return 'seatingPage.shapeOneSided';
      case 'four_sided':
        return 'seatingPage.shapeFourSided';
    }
  }

  /** Four-sided tables aren't stored as separate short/long counts — split the
   * total so editing an existing table starts from the sides that add up to it. */
  protected editingShortSeats(): number {
    const n = this.editingTable()?.seatCount;
    return n ? fourSidedSides(n).short : 2;
  }

  protected editingLongSeats(): number {
    const n = this.editingTable()?.seatCount;
    return n ? fourSidedSides(n).long : 3;
  }

  protected editingSeatCount(): number {
    return this.editingTable()?.seatCount ?? 8;
  }

  protected editingName(): string {
    return this.editingTable()?.name ?? '';
  }

  protected async submitCustomForm(form: HTMLFormElement): Promise<void> {
    const shape = this.customShape();
    const editing = this.editingTable();
    let seatCount: number;

    if (shape === 'four_sided') {
      const shortSel = form.elements.namedItem('shortSeats') as HTMLSelectElement | null;
      const longSel = form.elements.namedItem('longSeats') as HTMLSelectElement | null;
      const short = Math.max(1, Number(shortSel?.value) || 1);
      const long = Math.max(1, Number(longSel?.value) || 1);
      // Sides nobody touched keep the stored count (an odd one can't be shown as two sides).
      const untouched = !!editing && short === this.editingShortSeats() && long === this.editingLongSeats();
      seatCount = untouched ? editing.seatCount : short * 2 + long * 2;
    } else {
      const seatInput = form.elements.namedItem('seatCount') as HTMLInputElement | null;
      seatCount = Math.max(1, Math.min(40, Number(seatInput?.value) || 0));
    }
    if (!seatCount) return;

    const nameInput = form.elements.namedItem('tableName') as HTMLInputElement | null;
    const name = nameInput?.value.trim() || this.nextName();

    if (editing) {
      const losing = this.assignments().filter((a) => a.tableId === editing.id && a.seatIndex >= seatCount).length;
      if (losing > 0) {
        const ok = await this.confirmSvc.confirm({
          title: 'seatingPage.shrinkTitle',
          detail: this.t.instant('seatingPage.shrinkDetail', { n: losing }),
          body: 'seatingPage.shrinkBody',
          confirmLabel: 'seatingPage.shrinkConfirm',
          danger: true,
        });
        if (!ok) return;
      }
      const payload: SeatingTablePayload = { ...tablePayload(editing), name, shape, seatCount };
      this.seatingSvc.updateTable(editing.id, payload).subscribe({
        next: () => {
          this.tables.update((list) => list.map((t) => (t.id === editing.id ? { ...t, name, shape, seatCount } : t)));
          // Mirrors the backend: shrinking the seat count orphans assignments past the new count.
          this.assignments.update((list) => list.filter((a) => a.tableId !== editing.id || a.seatIndex < seatCount));
          this.closeModal();
        },
        error: () => this.toast.error('seatingPage.saveError'),
      });
      return;
    }

    const pos = this.nextPosition();
    this.seatingSvc.addTable({ name, shape, seatCount, positionX: pos.x, positionY: pos.y, rotation: 0 }).subscribe({
      next: (table) => {
        this.tables.update((list) => [...list, table]);
        this.closeModal();
      },
      error: () => this.toast.error('seatingPage.saveError'),
    });
  }

  // ---- table position / rename / delete ----

  protected onTableDragEnded(table: SeatingTable, event: CdkDragEnd): void {
    const dropped = event.source.getFreeDragPosition();
    const pos = onCanvas(dropped);
    if (pos.x !== dropped.x || pos.y !== dropped.y) event.source.setFreeDragPosition(pos);
    const payload: SeatingTablePayload = { ...tablePayload(table), positionX: pos.x, positionY: pos.y };
    this.seatingSvc.updateTable(table.id, payload).subscribe({
      next: () =>
        this.tables.update((list) =>
          list.map((t) => (t.id === table.id ? { ...t, positionX: pos.x, positionY: pos.y } : t)),
        ),
      error: () => this.toast.error('seatingPage.saveError'),
    });
  }

  protected startRename(table: SeatingTable): void {
    this.renamingTableId.set(table.id);
    if (this.isBrowser) {
      setTimeout(() => (this.host.nativeElement.querySelector('.seat-table__name-input') as HTMLInputElement | null)?.select());
    }
  }

  protected commitRename(table: SeatingTable, event: Event): void {
    const input = event.target as HTMLInputElement;
    const name = input.value.trim();
    this.renamingTableId.set(null);
    if (!name || name === table.name) return;

    const payload: SeatingTablePayload = { ...tablePayload(table), name };
    this.seatingSvc.updateTable(table.id, payload).subscribe({
      next: () => this.tables.update((list) => list.map((t) => (t.id === table.id ? { ...t, name } : t))),
      error: () => this.toast.error('seatingPage.saveError'),
    });
  }

  protected askRemoveTable(table: SeatingTable): void {
    void this.confirmSvc
      .confirm({
        title: 'seatingPage.removeTableTitle',
        detail: table.name,
        confirmLabel: 'seatingPage.removeTable',
        danger: true,
      })
      .then((ok) => {
        if (!ok) return;
        this.seatingSvc.removeTable(table.id).subscribe({
          next: () => {
            this.tables.update((list) => list.filter((t) => t.id !== table.id));
            this.assignments.update((list) => list.filter((a) => a.tableId !== table.id));
          },
          error: () => this.toast.error('seatingPage.saveError'),
        });
      });
  }

  // ---- venue objects (dance floor, bar, entrance, …) ----

  protected objectKind(type: SeatingObjectType): ObjectKindInfo {
    return OBJECT_CATALOG.find((o) => o.type === type)!;
  }

  protected addObject(type: SeatingObjectType): void {
    const info = this.objectKind(type);
    const pos = this.nextPosition();
    const payload: SeatingObjectPayload = { type, positionX: pos.x, positionY: pos.y, width: info.width, height: info.height, rotation: 0, label: null };
    this.seatingSvc.addObject(payload).subscribe({
      next: (obj) => this.objects.update((list) => [...list, obj]),
      error: () => this.toast.error('seatingPage.saveError'),
    });
  }

  protected onObjectDragEnded(obj: SeatingObject, event: CdkDragEnd): void {
    const dropped = event.source.getFreeDragPosition();
    const pos = onCanvas(dropped);
    if (pos.x !== dropped.x || pos.y !== dropped.y) event.source.setFreeDragPosition(pos);
    const payload: SeatingObjectPayload = { ...objectPayload(obj), positionX: pos.x, positionY: pos.y };
    this.seatingSvc.updateObject(obj.id, payload).subscribe({
      next: () =>
        this.objects.update((list) =>
          list.map((o) => (o.id === obj.id ? { ...o, positionX: pos.x, positionY: pos.y } : o)),
        ),
      error: () => this.toast.error('seatingPage.saveError'),
    });
  }

  // ---- turning tables and zones ----

  protected rotateTable(table: SeatingTable, delta: number): void {
    const rotation = (((table.rotation + delta) % 360) + 360) % 360;
    this.tables.update((list) => list.map((t) => (t.id === table.id ? { ...t, rotation } : t)));
    this.seatingSvc.updateTable(table.id, { ...tablePayload(table), rotation }).subscribe({
      error: () => {
        this.tables.update((list) => list.map((t) => (t.id === table.id ? { ...t, rotation: table.rotation } : t)));
        this.toast.error('seatingPage.saveError');
      },
    });
  }

  protected rotateObject(obj: SeatingObject, delta: number): void {
    const rotation = (((obj.rotation + delta) % 360) + 360) % 360;
    this.objects.update((list) => list.map((o) => (o.id === obj.id ? { ...o, rotation } : o)));
    this.seatingSvc.updateObject(obj.id, { ...objectPayload(obj), rotation }).subscribe({
      error: () => {
        this.objects.update((list) => list.map((o) => (o.id === obj.id ? { ...o, rotation: obj.rotation } : o)));
        this.toast.error('seatingPage.saveError');
      },
    });
  }

  /** A zone's own name, else its type's. */
  protected objectLabel(obj: SeatingObject): string {
    return obj.label || this.t.instant('seatingPage.objectType.' + this.objectKind(obj.type).i18nKey);
  }

  // ---- editing a zone: name and size ----

  protected openObjectEdit(obj: SeatingObject): void {
    this.editingObject.set(obj);
    this.modalStep.set('object');
    this.openModal('#om-label');
  }

  protected submitObjectForm(form: HTMLFormElement): void {
    const obj = this.editingObject();
    if (!obj) return;
    const num = (name: string, fallback: number) => {
      const v = Number((form.elements.namedItem(name) as HTMLInputElement | null)?.value);
      return Number.isFinite(v) && v > 0 ? Math.min(1200, Math.max(20, Math.round(v))) : fallback;
    };
    const label = ((form.elements.namedItem('objectLabel') as HTMLInputElement | null)?.value ?? '').trim() || null;
    const payload: SeatingObjectPayload = { ...objectPayload(obj), label, width: num('objectWidth', obj.width), height: num('objectHeight', obj.height) };
    this.seatingSvc.updateObject(obj.id, payload).subscribe({
      next: () => {
        this.objects.update((list) => list.map((o) => (o.id === obj.id ? { ...o, ...payload } : o)));
        this.closeModal();
      },
      error: () => this.toast.error('seatingPage.saveError'),
    });
  }

  // ---- the venue's floor plan ----

  private applyPlan(state: SeatingState): void {
    this.floorPlanUrl.set(state.floorPlanUrl);
    this.floorPlanVendorId.set(state.floorPlanVendorId);
    this.venuePlan.set(state.venuePlan);
  }

  /** A PDF becomes an image of its first page in the browser; an oversized photo is shrunk. */
  protected uploadPlan(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.planBusy.set(true);
    prepareFloorPlan(file).then(
      (ready) =>
        this.seatingSvc.uploadFloorPlan(ready).subscribe({
          next: (state) => this.planArrived(state),
          error: () => {
            this.planBusy.set(false);
            this.toast.error('seatingPage.saveError');
          },
        }),
      (err: unknown) => {
        this.planBusy.set(false);
        const code = err instanceof FloorPlanError ? err.code : 'type';
        this.toast.error(code === 'tooBig' ? 'seatingPage.planTooBig' : code === 'pdf' ? 'seatingPage.planPdfError' : 'seatingPage.planType');
      },
    );
  }

  /** The venue's own plan, copied under the chart (B5). */
  protected useVenuePlan(): void {
    const venue = this.venueSuggestion();
    if (!venue) return;
    this.planBusy.set(true);
    this.seatingSvc.useVenuePlan(venue.vendorId).subscribe({
      next: (state) => this.planArrived(state),
      error: () => {
        this.planBusy.set(false);
        this.toast.error('seatingPage.saveError');
      },
    });
  }

  private planArrived(state: SeatingState): void {
    this.planBusy.set(false);
    this.applyPlan(state);
    this.showPlan.set(true);
    this.toast.success('seatingPage.planAdded');
  }

  protected askRemovePlan(): void {
    void this.confirmSvc
      .confirm({ title: 'seatingPage.planRemoveTitle', body: 'seatingPage.planRemoveBody', confirmLabel: 'seatingPage.planRemove', danger: true })
      .then((ok) => {
        if (!ok) return;
        this.seatingSvc.removeFloorPlan().subscribe({
          next: (state) => this.applyPlan(state),
          error: () => this.toast.error('seatingPage.saveError'),
        });
      });
  }

  // ---- download, print, share ----

  /** Who sits at each table, in seat order, then the unseated: the printed list and the image's side list. */
  private seatingList(): { name: string; people: { seat: number; name: string; diet: string | null }[] }[] {
    return this.tables().map((t) => ({
      name: t.name,
      people: this.assignments()
        .filter((a) => a.tableId === t.id)
        .sort((a, b) => a.seatIndex - b.seatIndex)
        .map((a) => ({ seat: a.seatIndex + 1, name: this.attendeeFor(a)?.name ?? '', diet: this.attendeeFor(a)?.diet ?? null })),
    }));
  }

  /** The plan as an SVG drawing: floor plan (as a data URL), zones, tables with their seats, names beside. */
  private async chartSvg(): Promise<{ svg: string; width: number; height: number }> {
    const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const font = "'Noto Sans Georgian', 'BPG Arial', Sylfaen, 'Segoe UI', sans-serif";
    let maxX = 600;
    let maxY = 400;
    const parts: string[] = [];

    const plan = this.floorPlanUrl();
    if (plan && this.showPlan()) {
      const data = await this.imageData(plan);
      if (data) {
        parts.push(`<image href="${data.url}" x="0" y="0" width="${PLAN_WIDTH}" height="${(PLAN_WIDTH * data.h) / data.w}" opacity="0.55"/>`);
        maxX = Math.max(maxX, PLAN_WIDTH);
        maxY = Math.max(maxY, (PLAN_WIDTH * data.h) / data.w);
      }
    }

    for (const o of this.objects()) {
      const cx = o.positionX + o.width / 2;
      const cy = o.positionY + o.height / 2;
      maxX = Math.max(maxX, o.positionX + o.width + 40);
      maxY = Math.max(maxY, o.positionY + o.height + 40);
      parts.push(`<g transform="translate(${cx} ${cy}) rotate(${o.rotation})">` +
        `<rect x="${-o.width / 2}" y="${-o.height / 2}" width="${o.width}" height="${o.height}" rx="10" fill="#F0ECE6" stroke="#6d6868" stroke-dasharray="6 4"/>` +
        `<text x="0" y="5" text-anchor="middle" font-size="13" fill="#585454" transform="rotate(${-o.rotation})">${esc(this.objectLabel(o))}</text></g>`);
    }

    for (const t of this.tables()) {
      const { width, height } = this.tableSize(t);
      const cx = t.positionX + width / 2;
      const cy = t.positionY + height / 2;
      maxX = Math.max(maxX, t.positionX + width + 70);
      maxY = Math.max(maxY, t.positionY + height + 70);
      const shape = t.shape === 'round'
        ? `<ellipse cx="0" cy="0" rx="${width / 2}" ry="${height / 2}" fill="#fff" stroke="#302B2D" stroke-width="2"/>`
        : `<rect x="${-width / 2}" y="${-height / 2}" width="${width}" height="${height}" rx="12" fill="#fff" stroke="#302B2D" stroke-width="2"/>`;
      const seats = this.seatIndexes(t).map((i) => {
        const off = this.seatOffset(t, i);
        const occ = this.seatOccupant(t.id, i);
        const who = occ ? this.attendeeFor(occ) : undefined;
        const initial = who?.name ? esc([...who.name.trim()][0] ?? '') : String(i + 1);
        return `<circle cx="${off.x}" cy="${off.y}" r="15" fill="${who ? '#302B2D' : '#fff'}" stroke="#302B2D" stroke-width="1.5"/>` +
          `<text x="${off.x}" y="${off.y + 5}" text-anchor="middle" font-size="13" fill="${who ? '#FAF7F2' : '#6d6868'}" transform="rotate(${-t.rotation} ${off.x} ${off.y})">${initial}</text>`;
      }).join('');
      parts.push(`<g transform="translate(${cx} ${cy}) rotate(${t.rotation})">${shape}${seats}` +
        `<text x="0" y="5" text-anchor="middle" font-size="14" font-weight="600" fill="#302B2D" transform="rotate(${-t.rotation})">${esc(t.name)}</text></g>`);
    }

    // the names, table by table, to the right of the drawing
    const listX = maxX + 40;
    let y = 40;
    const list: string[] = [];
    for (const table of this.seatingList()) {
      list.push(`<text x="${listX}" y="${y}" font-size="16" font-weight="700" fill="#302B2D">${esc(table.name)}</text>`);
      y += 24;
      for (const p of table.people) {
        list.push(`<text x="${listX}" y="${y}" font-size="13" fill="#302B2D">${p.seat}. ${esc(p.name)}${p.diet ? ' · ' + esc(p.diet) : ''}</text>`);
        y += 19;
      }
      y += 14;
    }
    const width = listX + 340;
    const height = Math.max(maxY, y) + 20;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${font}">` +
      `<rect width="100%" height="100%" fill="#FAF7F2"/>${parts.join('')}${list.join('')}</svg>`;
    return { svg, width, height };
  }

  /** An image as a data URL (so it can be drawn and exported), or null if it can't be read. */
  private async imageData(url: string): Promise<{ url: string; w: number; h: number } | null> {
    try {
      const blob = await (await fetch(url, { mode: 'cors' })).blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
      const img = await this.loadImage(dataUrl);
      return { url: dataUrl, w: img.naturalWidth || 1, h: img.naturalHeight || 1 };
    } catch {
      return null;
    }
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  private async chartPng(): Promise<Blob> {
    const { svg, width, height } = await this.chartSvg();
    const img = await this.loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
    // Twice the size for a sharp image, less for a big wedding: past the pixel limit there is no image.
    const scale = Math.min(2, Math.sqrt(MAX_CANVAS_PIXELS / (width * height)));
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(width * scale);
    canvas.height = Math.floor(height * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);
    return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png'));
  }

  protected async downloadPng(): Promise<void> {
    if (!this.isBrowser || this.exporting()) return;
    this.exporting.set(true);
    try {
      const blob = await this.chartPng();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = this.t.instant('seatingPage.fileName') + '.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch {
      this.toast.error('seatingPage.exportError');
    } finally {
      this.exporting.set(false);
    }
  }

  protected async sharePng(): Promise<void> {
    if (!this.isBrowser || this.exporting()) return;
    this.exporting.set(true);
    try {
      const blob = await this.chartPng();
      const file = new File([blob], this.t.instant('seatingPage.fileName') + '.png', { type: 'image/png' });
      await navigator.share({ files: [file], title: this.t.instant('seatingPage.title') });
    } catch (e) {
      if ((e as DOMException)?.name !== 'AbortError') this.toast.error('seatingPage.exportError');
    } finally {
      this.exporting.set(false);
    }
  }

  /** The list per table (with dietary needs and the unseated) in a print window: print or save as PDF. */
  protected printList(): void {
    if (!this.isBrowser) return;
    const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const tables = this.seatingList()
      .map((t) => `<section><h2>${esc(t.name)} <small>${t.people.length}</small></h2><ol>${t.people
        .map((p) => `<li value="${p.seat}">${esc(p.name)}${p.diet ? ` <em>${esc(p.diet)}</em>` : ''}</li>`)
        .join('')}</ol></section>`)
      .join('');
    const unseated = this.unassignedAttendees();
    const rest = unseated.length
      ? `<section><h2>${esc(this.t.instant('seatingPage.unassignedTitle'))} <small>${unseated.length}</small></h2><ul>${unseated
          .map((a) => `<li>${esc(a.name)}${a.diet ? ` <em>${esc(a.diet)}</em>` : ''}</li>`)
          .join('')}</ul></section>`
      : '';
    const title = esc(this.t.instant('seatingPage.title'));
    const win = window.open('', '_blank');
    if (!win) {
      this.toast.error('seatingPage.exportError');
      return;
    }
    win.document.write(`<!doctype html><html lang="${this.lang.current()}"><head><meta charset="utf-8"><title>${title}</title><style>
      body{font-family:'Noto Sans Georgian','BPG Arial',Sylfaen,'Segoe UI',sans-serif;color:#302B2D;margin:32px;line-height:1.5}
      h1{font-size:24px;margin:0 0 4px}p{color:#585454;margin:0 0 24px}
      main{columns:2 260px;column-gap:40px}section{break-inside:avoid;margin:0 0 20px}
      h2{font-size:16px;margin:0 0 6px;border-bottom:1px solid #ccc;padding-bottom:4px}h2 small{color:#6d6868;font-weight:400}
      ol,ul{margin:0;padding-left:22px}li{font-size:14px}em{color:#6d6868;font-style:normal;font-size:12px}
    </style></head><body><h1>${title}</h1><p>${esc(this.t.instant('seatingPage.printMeta', { tables: this.tables().length, seated: this.totalSeated(), unseated: unseated.length }))}</p><main>${tables}${rest}</main></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  }

  protected askRemoveObject(obj: SeatingObject): void {
    void this.confirmSvc
      .confirm({
        title: 'seatingPage.removeObjectTitle',
        detail: this.objectLabel(obj),
        confirmLabel: 'seatingPage.removeObject',
        danger: true,
      })
      .then((ok) => {
        if (!ok) return;
        this.seatingSvc.removeObject(obj.id).subscribe({
          next: () => this.objects.update((list) => list.filter((o) => o.id !== obj.id)),
          error: () => this.toast.error('seatingPage.saveError'),
        });
      });
  }

  // ---- drag-and-drop seat assignment ----

  protected onDrop(event: CdkDragDrop<Attendee[]>): void {
    const fromId = event.previousContainer.id;
    const toId = event.container.id;
    if (fromId === toId) return;

    const attendee = event.item.data as Attendee;
    const toSeat = parseSeatListId(toId);

    if (toSeat) {
      if (this.seatOccupant(toSeat.tableId, toSeat.seatIndex)) {
        this.toast.error('seatingPage.seatTaken');
        return;
      }
      this.doAssign(toSeat.tableId, toSeat.seatIndex, attendee);
      return;
    }

    // Target is the unassigned pool — free up whichever seat the chip came from.
    const fromSeat = parseSeatListId(fromId);
    if (fromSeat) this.doUnassign(fromSeat.tableId, fromSeat.seatIndex);
  }

  private doAssign(tableId: number, seatIndex: number, attendee: Attendee): void {
    this.seatingSvc.assign({ tableId, seatIndex, guestId: attendee.guestId, attendeeKind: attendee.kind }).subscribe({
      next: () => {
        this.assignments.update((list) => [
          ...list.filter(
            (a) =>
              !(a.tableId === tableId && a.seatIndex === seatIndex) &&
              !(a.guestId === attendee.guestId && a.attendeeKind === attendee.kind),
          ),
          { tableId, seatIndex, guestId: attendee.guestId, attendeeKind: attendee.kind },
        ]);
      },
      error: () => this.toast.error('seatingPage.saveError'),
    });
  }

  private doUnassign(tableId: number, seatIndex: number): void {
    this.seatingSvc.unassign(tableId, seatIndex).subscribe({
      next: () => this.assignments.update((list) => list.filter((a) => !(a.tableId === tableId && a.seatIndex === seatIndex))),
      error: () => this.toast.error('seatingPage.saveError'),
    });
  }

  /** The × on a seated chip — unassigns without needing to drag. */
  protected unassignSeat(tableId: number, seatIndex: number): void {
    this.doUnassign(tableId, seatIndex);
  }
}
