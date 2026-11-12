import { Component, ElementRef, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Meta, Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ChecklistItem, ChecklistService, taskEdit, taskTitle } from '../../core/checklist.service';
import { ConfirmService } from '../../core/confirm.service';
import { CoupleService } from '../../core/couple.service';
import { formatDate } from '../../core/dates';
import { TASK_STAGES, isOverdue, stageDue, taskDue, taskLink } from '../../core/task-stages';
import { ToastService } from '../../core/toast.service';
import { LanguageService } from '../../i18n/language.service';

type Filter = 'open' | 'all' | 'done';

/**
 * „დავალებები“ (BUILD-PLAN B3, guide §6): the couple's tasks by stage, each with its deadline
 * (counted back from the wedding date unless they set their own), who's doing it and a button to
 * where it gets done („შეარჩიეთ სივრცე“ → the catalog's venues). Shared by both partners.
 */
@Component({
  selector: 'app-tasks',
  imports: [NgTemplateOutlet, ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './tasks.html',
  styleUrl: './tasks.scss',
  host: { class: 'theme-brand' },
})
export class Tasks {
  private readonly tasks = inject(ChecklistService);
  private readonly couple = inject(CoupleService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly lang = inject(LanguageService);
  private readonly fb = inject(FormBuilder);
  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly items = signal<ChecklistItem[]>([]);
  protected readonly loaded = signal(false);
  protected readonly loadError = signal(false);
  protected readonly weddingDate = signal<string | null>(null);
  protected readonly people = signal<string[]>([]);
  protected readonly filter = signal<Filter>('open');

  /** The form is open: 'new' adds, a number edits that task. */
  protected readonly editing = signal<'new' | number | null>(null);
  protected readonly saving = signal(false);

  protected readonly stages = TASK_STAGES;
  protected readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(300)]],
    stage: [''],
    dueDate: [''],
    who: ['', [Validators.maxLength(120)]],
  });

  protected readonly doneCount = computed(() => this.items().filter((i) => i.isDone).length);
  protected readonly overdueCount = computed(
    () => this.items().filter((i) => isOverdue(i, this.weddingDate())).length,
  );

  /** The tasks by stage (stage order, then "other"), with the filter applied; empty groups drop out. */
  protected readonly groups = computed(() => {
    const f = this.filter();
    const shown = this.items().filter((i) => (f === 'all' ? true : f === 'done' ? i.isDone : !i.isDone));
    const keys = [...TASK_STAGES.map((s) => s.key), null];
    return keys
      .map((key) => {
        const all = this.items().filter((i) => (key === null ? !TASK_STAGES.some((s) => s.key === i.stage) : i.stage === key));
        return {
          key,
          due: stageDue(key, this.weddingDate()),
          done: all.filter((i) => i.isDone).length,
          total: all.length,
          tasks: shown.filter((i) => all.includes(i)).sort((a, b) => a.sortOrder - b.sortOrder),
        };
      })
      .filter((g) => g.tasks.length > 0);
  });

  constructor() {
    const t = inject(TranslateService);
    inject(Title).setTitle(`${t.instant('tasks.title')} | ${t.instant('brand.name')}`);
    inject(Meta).updateTag({ name: 'robots', content: 'noindex' });
    if (isPlatformBrowser(inject(PLATFORM_ID))) this.load();
  }

  protected retry(): void {
    this.loadError.set(false);
    this.load();
  }

  private load(): void {
    this.tasks.list(this.lang.current()).subscribe({
      next: (items) => {
        this.items.set(items);
        this.loaded.set(true);
      },
      error: () => this.loadError.set(true),
    });
    this.couple
      .me()
      .pipe(catchError(() => of(null)))
      .subscribe((p) => {
        this.weddingDate.set(p?.weddingDate ?? null);
        this.people.set([p?.firstName, p?.partnerFirstName].filter((n): n is string => !!n?.trim()));
      });
  }

  // ------------------------------------------------------------------ done / not done

  protected toggle(item: ChecklistItem): void {
    const next = !item.isDone;
    this.patch(item.id, { isDone: next });
    this.tasks.update(item.id, { ...taskEdit(item), isDone: next }).subscribe({
      error: () => {
        this.patch(item.id, { isDone: item.isDone });
        this.toast.error('tasks.saveError');
      },
    });
  }

  // ------------------------------------------------------------------ add / edit / delete

  protected startAdd(stage: string | null = null): void {
    this.form.reset({ title: '', stage: stage ?? '', dueDate: '', who: '' });
    this.editing.set('new');
    this.focusForm();
  }

  protected startEdit(item: ChecklistItem): void {
    this.form.reset({ title: item.title, stage: item.stage ?? '', dueDate: item.dueDate ?? '', who: item.who ?? '' });
    this.editing.set(item.id);
    this.focusForm();
  }

  protected cancel(): void {
    this.editing.set(null);
  }

  protected save(): void {
    const title = this.form.controls.title;
    title.setValue((title.value ?? '').trim());
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      (this.host.nativeElement.querySelector('#task-title') as HTMLElement | null)?.focus();
      return;
    }
    const v = this.form.getRawValue();
    const t = (s: string | null | undefined) => (s ?? '').trim() || null;
    const body = { title: (v.title ?? '').trim(), stage: t(v.stage), dueDate: t(v.dueDate), who: t(v.who) };
    const editing = this.editing();
    const current = typeof editing === 'number' ? this.items().find((i) => i.id === editing) : undefined;
    this.saving.set(true);
    const request =
      editing === 'new' ? this.tasks.add(body) : this.tasks.update(editing as number, { ...body, isDone: current?.isDone ?? false });
    request.subscribe({
      next: (saved) => {
        this.items.update((list) => (editing === 'new' ? [...list, saved] : list.map((i) => (i.id === saved.id ? saved : i))));
        this.editing.set(null);
        this.saving.set(false);
        // A new task the filter would hide (e.g. "done") is still shown: switch to all.
        if (editing === 'new' && this.filter() === 'done') this.filter.set('all');
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('tasks.saveError');
      },
    });
  }

  protected async remove(item: ChecklistItem): Promise<void> {
    const ok = await this.confirm.confirm({ title: 'tasks.deleteTitle', detail: item.title, confirmLabel: 'tasks.delete', danger: true });
    if (!ok) return;
    this.tasks.remove(item.id).subscribe({
      next: () => this.items.update((list) => list.filter((i) => i.id !== item.id)),
      error: () => this.toast.error('tasks.saveError'),
    });
  }

  // ------------------------------------------------------------------ view helpers

  protected due(item: ChecklistItem): string | null {
    const d = taskDue(item, this.weddingDate());
    return d ? formatDate(d, this.lang.current(), 'medium') : null;
  }

  protected title(item: ChecklistItem): string {
    return taskTitle(item, this.lang.current());
  }

  protected overdue(item: ChecklistItem): boolean {
    return isOverdue(item, this.weddingDate());
  }

  protected stageDate(iso: string | null): string | null {
    return iso ? formatDate(iso, this.lang.current(), 'medium') : null;
  }

  protected link(item: ChecklistItem) {
    return taskLink(item.link);
  }

  private patch(id: number, change: Partial<ChecklistItem>): void {
    this.items.update((list) => list.map((i) => (i.id === id ? { ...i, ...change } : i)));
  }

  private focusForm(): void {
    setTimeout(() => (this.host.nativeElement.querySelector('#task-title') as HTMLElement | null)?.focus());
  }
}
