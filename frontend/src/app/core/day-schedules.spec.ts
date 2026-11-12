import { describe, expect, it } from 'vitest';

import { DAY_SCHEDULES, LocalText, iconFor, local, phaseStarts } from './day-schedules';

const texts = (t: LocalText | undefined): string[] => (t ? [t.ka, t.en] : []);

describe('DAY_SCHEDULES', () => {
  it('has the guide’s three scenarios with unique keys', () => {
    expect(DAY_SCHEDULES.map((s) => s.key)).toEqual(['one-venue', 'church-restaurant', 'reception-only']);
  });

  it('fills every text in both languages', () => {
    for (const s of DAY_SCHEDULES) {
      const all = [s.title, s.summary, s.note, ...s.rows.flatMap((r) => [r.activity, r.note, r.who])];
      for (const t of all.flatMap(texts)) expect(t.trim()).not.toBe('');
    }
  });

  it('runs forward in time (midnight counts as the end of the day)', () => {
    for (const s of DAY_SCHEDULES) {
      const minutes = s.rows.map((r) => {
        expect(r.time).toMatch(/^\d{2}:\d{2}$/);
        const [h, m] = r.time.split(':').map(Number);
        return (h === 0 ? 24 : h) * 60 + m;
      });
      expect(minutes).toEqual([...minutes].sort((a, b) => a - b));
    }
  });
});

describe('the day views', () => {
  it('draw an icon for every row and start a phase on a row that exists', () => {
    for (const s of DAY_SCHEDULES) {
      for (const r of s.rows) expect(iconFor(r.activity.ka), r.activity.ka).not.toBe('dot');
      const starts = phaseStarts(s.key);
      expect(starts[0]).toBe(0);
      expect(starts).toEqual([...starts].sort((a, b) => a - b));
      // the last phase leaves a row after its first one: the day bar marks that row too
      expect(starts[starts.length - 1]).toBeLessThan(s.rows.length - 1);
    }
  });
});

describe('local', () => {
  it('picks the language, and an empty string for a missing text', () => {
    expect(local({ ka: 'ტორტი', en: 'Cake' }, 'en')).toBe('Cake');
    expect(local(undefined, 'ka')).toBe('');
  });
});
