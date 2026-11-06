import { ChecklistItem } from './checklist.service';

/**
 * The task stages (PROPOSALS.md P8, B3) — the same keys as the API's StarterTasks — and how far
 * from the wedding each one's deadline falls: the start of its window ("10–12 months" → 10 months
 * before). "after" is two weeks after the wedding.
 */
export interface TaskStage {
  key: string;
  months?: number;
  days?: number;
}

export const TASK_STAGES: TaskStage[] = [
  { key: 'm12', months: 12 },
  { key: 'm10', months: 10 },
  { key: 'm8', months: 8 },
  { key: 'm6', months: 6 },
  { key: 'm4', months: 4 },
  { key: 'm2', months: 2 },
  { key: 'm1', months: 1 },
  { key: 'w1', days: 7 },
  { key: 'after', days: -14 },
];

/** 'yyyy-MM-dd' for a local date. */
function iso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The stage's deadline for a wedding date ('yyyy-MM-dd'), or null without one. */
export function stageDue(stage: string | null, weddingDate: string | null): string | null {
  const s = TASK_STAGES.find((x) => x.key === stage);
  if (!s || !weddingDate) return null;
  const [y, m, d] = weddingDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (s.months) {
    date.setMonth(date.getMonth() - s.months);
    // 31 March − 1 month must not roll over into March again
    if (date.getDate() !== d) date.setDate(0);
  }
  if (s.days) date.setDate(date.getDate() - s.days);
  return iso(date);
}

/** A task's deadline: the couple's own date, else its stage's. */
export function taskDue(task: ChecklistItem, weddingDate: string | null): string | null {
  return task.dueDate ?? stageDue(task.stage, weddingDate);
}

/** Overdue: not done and the deadline has passed (today counts as still on time). */
export function isOverdue(task: ChecklistItem, weddingDate: string | null, today = iso(new Date())): boolean {
  const due = taskDue(task, weddingDate);
  if (task.isDone || !due || due >= today) return false;
  // A stage whose time had passed before the task existed isn't late: there's just less time.
  if (!task.dueDate && task.createdAt && due < task.createdAt.slice(0, 10)) return false;
  return true;
}

/** Order for "what's next": by deadline (none last), then the stage order, then the list order. */
export function byDeadline(weddingDate: string | null) {
  const stageIndex = (s: string | null) => {
    const i = TASK_STAGES.findIndex((x) => x.key === s);
    return i < 0 ? TASK_STAGES.length : i;
  };
  return (a: ChecklistItem, b: ChecklistItem) => {
    const da = taskDue(a, weddingDate) ?? '9999';
    const db = taskDue(b, weddingDate) ?? '9999';
    return da.localeCompare(db) || stageIndex(a.stage) - stageIndex(b.stage) || a.sortOrder - b.sortOrder;
  };
}

/** Where a task opens: a route (+ query) and the button's i18n key. */
export interface TaskLink {
  route: string;
  query?: Record<string, string>;
  key: string;
}

export function taskLink(link: string | null): TaskLink | null {
  if (!link) return null;
  if (link.startsWith('catalog:')) {
    return { route: '/vendors', query: { category: link.slice('catalog:'.length) }, key: 'tasks.open.catalog' };
  }
  const pages: Record<string, string> = {
    budget: '/budget',
    guests: '/guests',
    settings: '/planning/settings',
    invitation: '/planning/invitation',
    day: '/planning/day',
    seating: '/seating',
    services: '/planning/services',
  };
  return pages[link] ? { route: pages[link], key: `tasks.open.${link}` } : null;
}
