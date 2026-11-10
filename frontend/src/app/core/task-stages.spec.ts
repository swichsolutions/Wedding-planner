import { describe, expect, it } from 'vitest';

import { ChecklistItem } from './checklist.service';
import { byDeadline, isOverdue, stageDue, taskDue, taskLink } from './task-stages';

const task = (over: Partial<ChecklistItem>): ChecklistItem => ({
  id: 1, title: 't', isDone: false, sortOrder: 0, stage: null, dueDate: null, who: null, link: null, ...over,
});

describe('stageDue', () => {
  it('counts back from the wedding date by the start of the stage', () => {
    expect(stageDue('m12', '2027-09-18')).toBe('2026-09-18');
    expect(stageDue('m10', '2027-09-18')).toBe('2026-11-18');
    expect(stageDue('w1', '2027-09-18')).toBe('2027-09-11');
    expect(stageDue('after', '2027-09-18')).toBe('2027-10-02');
  });

  it('lands on the last day of a shorter month instead of rolling over', () => {
    expect(stageDue('m1', '2027-03-31')).toBe('2027-02-28');
    expect(stageDue('m6', '2027-08-31')).toBe('2027-02-28');
  });

  it('is null without a wedding date or a stage', () => {
    expect(stageDue('m12', null)).toBeNull();
    expect(stageDue(null, '2027-09-18')).toBeNull();
  });
});

describe('taskDue / isOverdue', () => {
  it('prefers the couple’s own date', () => {
    expect(taskDue(task({ stage: 'm12', dueDate: '2026-12-01' }), '2027-09-18')).toBe('2026-12-01');
  });

  it('is overdue only when open and past', () => {
    const t = task({ dueDate: '2026-10-01' });
    expect(isOverdue(t, null, '2026-10-02')).toBe(true);
    expect(isOverdue(t, null, '2026-10-01')).toBe(false);
    expect(isOverdue({ ...t, isDone: true }, null, '2026-10-02')).toBe(false);
  });
});

describe('byDeadline', () => {
  it('sorts by deadline, then stage, with undated tasks last', () => {
    const list = [
      task({ id: 1, stage: null }),
      task({ id: 2, stage: 'm6' }),
      task({ id: 3, stage: 'm12' }),
      task({ id: 4, dueDate: '2026-01-01' }),
    ];
    expect(list.sort(byDeadline('2027-09-18')).map((t) => t.id)).toEqual([4, 3, 2, 1]);
    // without a wedding date, stages still give the order
    expect(list.sort(byDeadline(null)).map((t) => t.id)).toEqual([4, 3, 2, 1]);
  });
});

describe('taskLink', () => {
  it('opens a catalog category or an organizer page', () => {
    expect(taskLink('catalog:darbazi')).toEqual({ route: '/vendors', query: { category: 'darbazi' }, key: 'tasks.open.catalog' });
    expect(taskLink('catalog:darbazi?features=accommodation')).toEqual({
      route: '/vendors', query: { category: 'darbazi', features: 'accommodation' }, key: 'tasks.open.catalog',
    });
    expect(taskLink('day')).toEqual({ route: '/planning/day', key: 'tasks.open.day' });
    expect(taskLink('nope')).toBeNull();
    expect(taskLink(null)).toBeNull();
  });
});

describe('isOverdue for a plan started late', () => {
  it('a stage already past when the task was created is not late', () => {
    expect(isOverdue(task({ stage: 'm12', createdAt: '2027-05-01T10:00:00Z' }), '2027-09-18', '2027-06-01')).toBe(false);
  });
  it('a stage that passes after that is', () => {
    expect(isOverdue(task({ stage: 'm2', createdAt: '2027-05-01T10:00:00Z' }), '2027-09-18', '2027-08-01')).toBe(true);
  });
  it('the couple\'s own date is always held to', () => {
    expect(isOverdue(task({ dueDate: '2027-04-01', createdAt: '2027-05-01T10:00:00Z' }), '2027-09-18', '2027-06-01')).toBe(true);
  });
});
