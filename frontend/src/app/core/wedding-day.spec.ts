import { describe, expect, it } from 'vitest';

import { scheduleRows } from './day-schedules';
import { dayTimeKey } from './wedding-day.service';

describe('dayTimeKey', () => {
  it('orders a wedding day: morning, evening, after midnight, then no time', () => {
    const times = ['00:00', null, '18:30', '11:00', '23:30', '04:59', '05:00'];
    const sorted = [...times].sort((a, b) => dayTimeKey(a) - dayTimeKey(b));
    expect(sorted).toEqual(['05:00', '11:00', '18:30', '23:30', '00:00', '04:59', null]);
  });

  it('puts anything that is not HH:mm last', () => {
    expect(dayTimeKey('7:30')).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe('scheduleRows', () => {
  it('turns an example into rows in the chosen language', () => {
    const ka = scheduleRows('church-restaurant', 'ka')!;
    const en = scheduleRows('church-restaurant', 'en')!;
    expect(ka).toHaveLength(9);
    expect(ka[1]).toMatchObject({ time: '13:30', activity: 'სტუმრების შეკრება ეკლესიასთან', contact: null });
    expect(en[1].activity).toBe('Guests gather at the church');
    // a row without a note or a responsible person sends null, not an empty string
    expect(ka[ka.length - 1]).toMatchObject({ activity: 'წვეულების დასრულება', note: null, who: null });
  });

  it('is null for an unknown example', () => {
    expect(scheduleRows('nope', 'ka')).toBeNull();
  });
});
