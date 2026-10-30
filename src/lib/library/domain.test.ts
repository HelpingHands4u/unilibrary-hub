import { describe, expect, it } from 'vitest';
import { apply, DEFAULTS, PermissionError } from './domain.server';

const now = new Date('2026-10-30T10:00:00Z');
function state() {
  return {
    settings: { ...DEFAULTS },
    users: [{ id: 'stu', name: 'Asha', active: true, maxBorrowLimit: 4 }, { id: 'lib', name: 'Lib', active: true }],
    books: [{ id: 'b1', title: 'Algorithms', format: 'physical', borrowCount: 0 }],
    copies: [{ id: 'c1', bookId: 'b1', barcode: 'UL1', status: 'available' }],
    loans: [] as any[], reservations: [] as any[], fines: [] as any[], wishlists: [], notifications: [], reviews: [], resources: [], audit: [], recent: [],
  } as any;
}

describe('server library rules', () => {
  it('students cannot issue books', () => {
    expect(() => apply(state(), 'stu', 'student', 'issue', ['stu', 'UL1', 14], now)).toThrow(PermissionError);
  });
  it('returning 3 days late charges ₹5 per day = ₹15', () => {
    const s = state();
    apply(s, 'lib', 'librarian', 'issue', ['stu', 'UL1', 14], now);
    const r = apply(s, 'lib', 'librarian', 'returnCopy', ['UL1', false], new Date('2026-11-16T10:00:00Z'));
    expect(r.amount).toBe(15);
  });
  it('borrowing is blocked when unpaid fines exceed ₹100', () => {
    const s = state();
    s.fines.push({ id: 'f', userId: 'stu', amount: 101, status: 'unpaid' });
    expect(() => apply(s, 'lib', 'librarian', 'issue', ['stu', 'UL1', 14], now)).toThrow('Unpaid fines');
  });
  it('reserving an available copy holds it', () => {
    const s = state();
    apply(s, 'stu', 'student', 'reserve', ['b1'], now);
    expect(s.copies[0].status).toBe('on_hold');
  });
});
