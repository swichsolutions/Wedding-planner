import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

export type TableShape = 'round' | 'rectangular' | 'one_sided' | 'four_sided';
export type AttendeeKind = 'primary' | 'plus_one' | 'child';
export type SeatingObjectType =
  | 'dance_floor'
  | 'cake_table'
  | 'gift_table'
  | 'buffet_table'
  | 'bar'
  | 'dj_booth'
  | 'band'
  | 'photo_booth'
  | 'stage'
  | 'podium'
  | 'entrance'
  | 'door';

export interface SeatingTable {
  id: number;
  name: string;
  shape: TableShape;
  seatCount: number;
  positionX: number;
  positionY: number;
  /** Clockwise degrees, 0–359. */
  rotation: number;
}

export interface SeatingTablePayload {
  name: string;
  shape: TableShape;
  seatCount: number;
  positionX: number;
  positionY: number;
  rotation: number;
}

export interface SeatAssignment {
  tableId: number;
  seatIndex: number;
  guestId: number;
  attendeeKind: AttendeeKind;
}

export interface SeatingObject {
  id: number;
  type: SeatingObjectType;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  rotation: number;
  /** The couple's own name for it; the type's name when null. */
  label: string | null;
}

export interface SeatingObjectPayload {
  type: SeatingObjectType;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  rotation: number;
  label: string | null;
}

export interface SeatingState {
  tables: SeatingTable[];
  assignments: SeatAssignment[];
  objects: SeatingObject[];
  /** The floor plan under the chart: the couple's upload or their copy of the venue's. */
  floorPlanUrl: string | null;
  /** The venue the plan was copied from; null for the couple's own upload. */
  floorPlanVendorId: number | null;
  /** The couple's venue (chosen first, else shortlisted or saved) when it has a floor plan. */
  venuePlan: VenuePlan | null;
}

export interface VenuePlan {
  vendorId: number;
  name: string;
  floorPlanUrl: string;
}

/** The table payload that keeps everything as it is (spread changes over it). */
export function tablePayload(t: SeatingTable): SeatingTablePayload {
  return { name: t.name, shape: t.shape, seatCount: t.seatCount, positionX: t.positionX, positionY: t.positionY, rotation: t.rotation };
}

export function objectPayload(o: SeatingObject): SeatingObjectPayload {
  return { type: o.type, positionX: o.positionX, positionY: o.positionY, width: o.width, height: o.height, rotation: o.rotation, label: o.label };
}

/** The couple's seating chart API (requires Couple role; token via interceptor). */
@Injectable({ providedIn: 'root' })
export class SeatingService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  load(): Observable<SeatingState> {
    return this.http.get<SeatingState>(`${this.base}/api/planning/seating`);
  }

  addTable(payload: SeatingTablePayload): Observable<SeatingTable> {
    return this.http.post<SeatingTable>(`${this.base}/api/planning/seating/tables`, payload);
  }

  updateTable(id: number, payload: SeatingTablePayload): Observable<void> {
    return this.http.put<void>(`${this.base}/api/planning/seating/tables/${id}`, payload);
  }

  removeTable(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/planning/seating/tables/${id}`);
  }

  assign(assignment: SeatAssignment): Observable<void> {
    return this.http.put<void>(`${this.base}/api/planning/seating/assign`, assignment);
  }

  unassign(tableId: number, seatIndex: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/planning/seating/assign/${tableId}/${seatIndex}`);
  }

  addObject(payload: SeatingObjectPayload): Observable<SeatingObject> {
    return this.http.post<SeatingObject>(`${this.base}/api/planning/seating/objects`, payload);
  }

  updateObject(id: number, payload: SeatingObjectPayload): Observable<void> {
    return this.http.put<void>(`${this.base}/api/planning/seating/objects/${id}`, payload);
  }

  removeObject(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/planning/seating/objects/${id}`);
  }

  /** Seat a guest's whole party at a table (free seats, in order), or unseat it (tableId null). */
  seatGuest(guestId: number, tableId: number | null): Observable<SeatAssignment[]> {
    return this.http.put<SeatAssignment[]>(`${this.base}/api/planning/seating/seat-guest`, { guestId, tableId });
  }

  uploadFloorPlan(file: File): Observable<SeatingState> {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<SeatingState>(`${this.base}/api/planning/seating/floor-plan`, body);
  }

  removeFloorPlan(): Observable<SeatingState> {
    return this.http.delete<SeatingState>(`${this.base}/api/planning/seating/floor-plan`);
  }

  /** Puts a copy of the venue's own floor plan under the chart. */
  useVenuePlan(vendorId: number): Observable<SeatingState> {
    return this.http.put<SeatingState>(`${this.base}/api/planning/seating/floor-plan/from-venue`, { vendorId });
  }
}
