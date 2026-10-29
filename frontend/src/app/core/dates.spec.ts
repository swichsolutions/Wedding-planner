import { describe, expect, it } from 'vitest';

import { formatDate, monthName, todayIso } from './dates';

describe('formatDate', () => {
  it('spells Georgian months out', () => {
    expect(formatDate('2026-10-19T10:00:00Z', 'ka')).toBe('19 ოქტომბერი, 2026');
    expect(formatDate('2026-01-05T10:00:00Z', 'ka', 'medium')).toBe('5 იან. 2026');
  });

  it('uses the Tbilisi calendar day (UTC+4)', () => {
    // 21:30 UTC on Oct 19 is already Oct 20 in Tbilisi.
    expect(formatDate('2026-10-19T21:30:00Z', 'ka')).toBe('20 ოქტომბერი, 2026');
    // A date-only value (wedding dates) stays on its day.
    expect(formatDate('2027-09-12', 'ka')).toBe('12 სექტემბერი, 2027');
  });

  it('formats English with Intl', () => {
    expect(formatDate('2026-10-19T10:00:00Z', 'en')).toBe('October 19, 2026');
    expect(formatDate('2026-10-19T10:00:00Z', 'en', 'medium')).toBe('Oct 19, 2026');
  });

  it('returns an empty string for missing or invalid input', () => {
    expect(formatDate(null, 'ka')).toBe('');
    expect(formatDate('not a date', 'ka')).toBe('');
  });
});

describe('todayIso', () => {
  it('is the Tbilisi calendar day, padded', () => {
    // 21:30 UTC on 4 Mar is already 5 Mar in Tbilisi (UTC+4).
    expect(todayIso(new Date('2026-03-04T21:30:00Z'))).toBe('2026-03-05');
    expect(todayIso(new Date('2026-11-09T08:00:00Z'))).toBe('2026-11-09');
  });
});

describe('monthName', () => {
  it('names months without the browser locale data', () => {
    expect(monthName(0, 'ka')).toBe('იანვარი');
    expect(monthName(9, 'ka')).toBe('ოქტომბერი');
    expect(monthName(9, 'en')).toBe('October');
  });

  it('reads a date-only value as that day', () => {
    // The invitation and RSVP deadline send 'yyyy-MM-dd'.
    expect(formatDate('2027-09-18', 'ka')).toBe('18 სექტემბერი, 2027');
  });
});
