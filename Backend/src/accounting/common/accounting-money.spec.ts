import { ConflictException } from '@nestjs/common';
import { validateBalancedLines } from './accounting-money.js';

describe('validateBalancedLines', () => {
  it('uses exact decimal arithmetic for a balanced entry', () => {
    const result = validateBalancedLines([
      { debit: '0.10', credit: '0' },
      { debit: '0.20', credit: '0' },
      { debit: '0', credit: '0.30' },
    ]);
    expect(result.totalDebit).toBe('0.3000');
    expect(result.totalCredit).toBe('0.3000');
  });

  it('rejects unbalanced entries with a stable accounting error', () => {
    expect(() =>
      validateBalancedLines([
        { debit: '10.00', credit: '0' },
        { debit: '0', credit: '9.99' },
      ]),
    ).toThrow(ConflictException);
  });

  it.each([
    [[{ debit: '10', credit: '0' }]],
    [
      [
        { debit: '10', credit: '10' },
        { debit: '0', credit: '20' },
      ],
    ],
    [
      [
        { debit: '0', credit: '0' },
        { debit: '0', credit: '1' },
      ],
    ],
  ])('rejects invalid line structure', (lines) => {
    expect(() => validateBalancedLines(lines)).toThrow(ConflictException);
  });
});
