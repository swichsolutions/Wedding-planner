import { describe, expect, it } from 'vitest';

import { nameInitial } from './name-initial';

describe('nameInitial', () => {
  it('upper-cases a Latin first letter', () => {
    expect(nameInitial('studio nine')).toBe('S');
    expect(nameInitial('  élan')).toBe('É');
  });

  it('leaves a Georgian letter as it is (no Mtavruli capitals)', () => {
    expect(nameInitial('ბენდი')).toBe('ბ');
    expect(nameInitial('ქორწილის სახლი')).toBe('ქ');
    expect(/[\u1C90-\u1CBF]/.test(nameInitial('წითელი ვარდი'))).toBe(false);
  });

  it('takes a whole character, and nothing from an empty name', () => {
    expect(nameInitial('💐 flowers')).toBe('💐');
    expect(nameInitial('   ')).toBe('');
  });
});
