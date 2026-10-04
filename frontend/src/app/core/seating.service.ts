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
}

export interface SeatingTablePayload {
  name: string;
  shape: TableShape;
  seatCount: number;
  positionX: number;
  positionY: number;
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
}

export interface SeatingObjectPayload {
  type: SeatingObjectType;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
}

export interface SeatingState {
  tables: SeatingTable[];
  assignments: SeatAssignment[];
  objects: SeatingObject[];
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
}
