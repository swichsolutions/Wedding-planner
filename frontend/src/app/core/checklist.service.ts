import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

/** A task („დავალებები“, B3). The stage and the wedding date decide its deadline unless dueDate is set. */
export interface ChecklistItem {
  id: number;
  title: string;
  isDone: boolean;
  sortOrder: number;
  /** m12, m10, m8, m6, m4, m2, m1, w1, after — or null (no stage). */
  stage: string | null;
  /** 'yyyy-MM-dd', the couple's own deadline. */
  dueDate: string | null;
  who: string | null;
  /** Where the task opens (see core/task-stages.ts taskLink). */
  link: string | null;
  /** A starter task's wording in each language; null once it's custom or edited. */
  titleKa?: string | null;
  titleEn?: string | null;
  createdAt?: string;
}

/** The task's title in the visitor's language, when it's one of the starter tasks. */
export function taskTitle(item: ChecklistItem, lang: string): string {
  return (lang === 'en' ? item.titleEn : item.titleKa) ?? item.title;
}

export interface TaskEdit {
  title: string;
  isDone: boolean;
  stage: string | null;
  dueDate: string | null;
  who: string | null;
}

/** The couple's tasks API (Couple role; token via interceptor). Shared by both partners. */
@Injectable({ providedIn: 'root' })
export class ChecklistService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/api/planning/checklist`;

  /** The tasks; a new plan gets the starter list, in this language. */
  list(lang: string): Observable<ChecklistItem[]> {
    return this.http.get<ChecklistItem[]>(this.base, { params: { lang } });
  }

  add(task: Omit<TaskEdit, 'isDone'>): Observable<ChecklistItem> {
    return this.http.post<ChecklistItem>(this.base, task);
  }

  update(id: number, task: TaskEdit): Observable<ChecklistItem> {
    return this.http.put<ChecklistItem>(`${this.base}/${id}`, task);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}

/** The editable part of a task (to send its full state back after one change). */
export function taskEdit(item: ChecklistItem): TaskEdit {
  return { title: item.title, isDone: item.isDone, stage: item.stage, dueDate: item.dueDate, who: item.who };
}
