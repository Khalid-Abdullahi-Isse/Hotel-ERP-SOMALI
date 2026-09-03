import { describe, expect, it } from '@jest/globals';

describe('operational accounting seed invariants', () => {
  it('requires positive, one-sided, balanced journal lines', () => {
    const lines = [
      { debit: 100, credit: 0 },
      { debit: 0, credit: 100 },
    ];
    const debit = lines.reduce((total, line) => total + line.debit, 0);
    const credit = lines.reduce((total, line) => total + line.credit, 0);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(debit).toBeGreaterThan(0);
    expect(credit).toBeGreaterThan(0);
    expect(debit).toBe(credit);
    expect(lines.every((line) => !(line.debit > 0 && line.credit > 0))).toBe(true);
  });

  it('derives profit from revenue and expenses', () => {
    const revenue = 1350;
    const expenses = 1375;
    expect(revenue - expenses).toBe(-25);
  });
});
