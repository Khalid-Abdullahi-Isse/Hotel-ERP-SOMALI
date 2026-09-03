import { assertBalancedSeedEntry } from '../src/accounting/common/accounting-seed-validation.js';

describe('accounting seed validation', () => {
  it('accepts a balanced double-entry journal', () => {
    expect(() =>
      assertBalancedSeedEntry([
        { accountCode: '1110', debit: 20000, credit: 0 },
        { accountCode: '3100', debit: 0, credit: 20000 },
      ]),
    ).not.toThrow();
  });

  it('rejects an unbalanced journal', () => {
    expect(() =>
      assertBalancedSeedEntry([
        { accountCode: '1110', debit: 20000, credit: 0 },
        { accountCode: '3100', debit: 0, credit: 15000 },
      ]),
    ).toThrow(/balanced/i);
  });
});
