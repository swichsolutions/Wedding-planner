import { describe, expect, it } from 'vitest';

import { relatedPages } from './related-pages';

const paths = (topic: string | null, slug = 'x', action?: string | null) => relatedPages(topic, slug, action).map((p) => p.path);

describe('relatedPages', () => {
  it('leads each article topic to its tool or catalog page first', () => {
    expect(paths('budget')[0]).toBe('/budget');
    expect(paths('guests')[0]).toBe('/guests');
    expect(paths('day')[0]).toBe('/ganrigebi');
    expect(paths('invitation')[0]).toBe('/invitations');
    expect(paths('start')[0]).toBe('/planning');
    expect(paths('vendors')[0]).toBe('/vendors');
  });

  it('sends an article about choosing the venue to the venues group', () => {
    expect(paths('vendors', 'rogor-avirchiot-darbazi')[0]).toBe('/sivrtseebi-da-kveba');
  });

  it('leaves out the page the action button already opens, keeping the rest', () => {
    expect(paths('budget', 'x', '/budget')).toEqual(['/vendors', '/planning']);
    expect(paths('guests', 'x', '/guests?x=1')).toEqual(['/seating', '/invitations']);
  });

  it('gives nothing for no topic or an unknown one', () => {
    expect(paths(null)).toEqual([]);
    expect(paths('colors')).toEqual([]);
    expect(paths('constructor')).toEqual([]);
  });

  it('never lists a page twice', () => {
    for (const topic of ['start', 'budget', 'guests', 'day', 'invitation', 'vendors']) {
      const list = paths(topic);
      expect(new Set(list).size).toBe(list.length);
    }
  });
});
