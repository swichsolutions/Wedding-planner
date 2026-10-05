import { Component, ElementRef, HostListener, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
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
import { Guest, GuestService } from '../../core/guest.service';
import {
  AttendeeKind,
  SeatAssignment,
  SeatingObject,
  SeatingObjectPayload,
  SeatingObjectType,
  SeatingService,
  SeatingTable,
  SeatingTablePayload,
  TableShape,
} from '../../core/seating.service';
import { ConfirmService } from '../../core/confirm.service';
import { ToastService } from '../../core/toast.service';
import { FeatureLanding } from '../../components/feature-landing/feature-landing';

interface Attendee {
  guestId: number;
  kind: AttendeeKind;
  name: string;
}

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

/**
 * Free-form seating chart: couples add tables (four quick presets or a custom
 * shape/seat-count), drag each table anywhere on the canvas to mirror their venue,
 * then drag guests from the unassigned pool onto individual seats.
 */
@Component({
  selector: 'app-seating-chart',
  imports: [TranslatePipe, CdkDropListGroup, CdkDropList, CdkDrag, CdkDragHandle, FeatureLanding],
  templateUrl: './seating-chart.html',
  styleUrl: './seating-chart.scss',
})
export class SeatingChart {
  private readonly auth = inject(AuthService);
  private readonly guestSvc = inject(GuestService);
  private readonly seatingSvc = inject(SeatingService);
  private readonly confirmSvc = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly t = inject(TranslateService);
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

  protected readonly presets = PRESETS;
  protected readonly objectSections = OBJECT_SECTIONS;

  // ---- add/edit side drawer (one entry point for both tables and venue items) ----
  protected readonly shapes: TableShape[] = ['round', 'one_sided', 'rectangular', 'four_sided'];
  protected readonly drawerOpen = signal(false);
  protected readonly modalStep = signal<'browse' | 'custom'>('browse');
  protected readonly customShape = signal<TableShape>('round');
  protected readonly editingTable = signal<SeatingTable | null>(null);
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
  }

  private loadAll(): void {
    this.loadError.set(false);
    this.guestSvc.list().subscribe({
      next: (list) => this.guests.set(list),
      error: () => this.loadError.set(true),
    });
    this.seatingSvc.load().subscribe({
      next: (state) => {
        this.tables.set(state.tables);
        this.assignments.set(state.assignments);
        this.objects.set(state.objects);
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
    const list: Attendee[] = [{ guestId: guest.id, kind: 'primary', name: [guest.firstName, guest.lastName].filter(Boolean).join(' ') }];
    if (guest.hasPlusOne) {
      const name = guest.plusOneNameUnknown
        ? this.t.instant('seatingPage.plusOneUnknown')
        : [guest.plusOneFirstName, guest.plusOneLastName].filter(Boolean).join(' ');
      list.push({ guestId: guest.id, kind: 'plus_one', name });
    }
    if (guest.hasChild) {
      const name = guest.childNameUnknown
        ? this.t.instant('seatingPage.childUnknown')
        : [guest.childFirstName, guest.childLastName].filter(Boolean).join(' ');
      list.push({ guestId: guest.id, kind: 'child', name });
    }
    return list;
  }

  protected readonly allAttendees = computed<Attendee[]>(() => this.guests().flatMap((g) => this.attendeesFor(g)));

  private readonly assignedKeySet = computed(() => new Set(this.assignments().map((a) => `${a.guestId}:${a.attendeeKind}`)));

  protected readonly unassignedAttendees = computed(() =>
    this.allAttendees().filter((a) => !this.assignedKeySet().has(`${a.guestId}:${a.kind}`)),
  );

  protected readonly totalSeated = computed(() => this.assignments().length);

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
    this.addTable({ name: this.nextName(), shape: preset.shape, seatCount: preset.seatCount, positionX: pos.x, positionY: pos.y });
    this.closeModal();
  }

  /** Same table again, offset so it doesn't sit exactly on top of the original. */
  protected duplicateTable(table: SeatingTable): void {
    const pos = this.nextPosition();
    const name = `${table.name} ${this.t.instant('seatingPage.copySuffix')}`;
    this.addTable({ name, shape: table.shape, seatCount: table.seatCount, positionX: pos.x, positionY: pos.y });
  }

  // ---- add/edit side drawer ----

  protected openAddModal(): void {
    this.editingTable.set(null);
    this.customShape.set('round');
    this.modalStep.set('browse');
    this.openModal();
  }

  protected openEditModal(table: SeatingTable): void {
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
   * total evenly so editing an existing table starts from a sensible guess. */
  protected editingShortSeats(): number {
    const n = this.editingTable()?.seatCount;
    return n ? Math.max(1, Math.round(n / 4)) : 2;
  }

  protected editingLongSeats(): number {
    const n = this.editingTable()?.seatCount;
    return n ? Math.max(1, Math.round(n / 4)) : 3;
  }

  protected editingSeatCount(): number {
    return this.editingTable()?.seatCount ?? 8;
  }

  protected editingName(): string {
    return this.editingTable()?.name ?? '';
  }

  protected submitCustomForm(form: HTMLFormElement): void {
    const shape = this.customShape();
    let seatCount: number;

    if (shape === 'four_sided') {
      const shortSel = form.elements.namedItem('shortSeats') as HTMLSelectElement | null;
      const longSel = form.elements.namedItem('longSeats') as HTMLSelectElement | null;
      const short = Math.max(1, Number(shortSel?.value) || 1);
      const long = Math.max(1, Number(longSel?.value) || 1);
      seatCount = short * 2 + long * 2;
    } else {
      const seatInput = form.elements.namedItem('seatCount') as HTMLInputElement | null;
      seatCount = Math.max(1, Math.min(40, Number(seatInput?.value) || 0));
    }
    if (!seatCount) return;

    const nameInput = form.elements.namedItem('tableName') as HTMLInputElement | null;
    const name = nameInput?.value.trim() || this.nextName();
    const editing = this.editingTable();

    if (editing) {
      const payload: SeatingTablePayload = { name, shape, seatCount, positionX: editing.positionX, positionY: editing.positionY };
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
    this.seatingSvc.addTable({ name, shape, seatCount, positionX: pos.x, positionY: pos.y }).subscribe({
      next: (table) => {
        this.tables.update((list) => [...list, table]);
        this.closeModal();
      },
      error: () => this.toast.error('seatingPage.saveError'),
    });
  }

  // ---- table position / rename / delete ----

  protected onTableDragEnded(table: SeatingTable, event: CdkDragEnd): void {
    const pos = event.source.getFreeDragPosition();
    const payload: SeatingTablePayload = { name: table.name, shape: table.shape, seatCount: table.seatCount, positionX: pos.x, positionY: pos.y };
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

    const payload: SeatingTablePayload = { name, shape: table.shape, seatCount: table.seatCount, positionX: table.positionX, positionY: table.positionY };
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
    const payload: SeatingObjectPayload = { type, positionX: pos.x, positionY: pos.y, width: info.width, height: info.height };
    this.seatingSvc.addObject(payload).subscribe({
      next: (obj) => this.objects.update((list) => [...list, obj]),
      error: () => this.toast.error('seatingPage.saveError'),
    });
  }

  protected onObjectDragEnded(obj: SeatingObject, event: CdkDragEnd): void {
    const pos = event.source.getFreeDragPosition();
    const payload: SeatingObjectPayload = {
      type: obj.type,
      positionX: pos.x,
      positionY: pos.y,
      width: obj.width,
      height: obj.height,
    };
    this.seatingSvc.updateObject(obj.id, payload).subscribe({
      next: () =>
        this.objects.update((list) =>
          list.map((o) => (o.id === obj.id ? { ...o, positionX: pos.x, positionY: pos.y } : o)),
        ),
      error: () => this.toast.error('seatingPage.saveError'),
    });
  }

  protected askRemoveObject(obj: SeatingObject): void {
    void this.confirmSvc
      .confirm({
        title: 'seatingPage.removeObjectTitle',
        detail: this.t.instant('seatingPage.objectType.' + this.objectKind(obj.type).i18nKey),
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
