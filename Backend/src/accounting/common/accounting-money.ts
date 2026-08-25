import { ConflictException } from '@nestjs/common';

export interface MoneyLine {
  debit: string | { toString(): string };
  credit: string | { toString(): string };
}

export function validateBalancedLines(lines: readonly MoneyLine[]): {
  totalDebit: string;
  totalCredit: string;
} {
  if (lines.length < 2) {
    throw new ConflictException({
      code: 'ACCOUNTING_ENTRY_REQUIRES_TWO_LINES',
      message: 'A journal entry must contain at least two lines.',
    });
  }

  let totalDebit = 0n;
  let totalCredit = 0n;
  for (const line of lines) {
    const debit = toScaledInteger(line.debit);
    const credit = toScaledInteger(line.credit);
    if (debit < 0n || credit < 0n || debit === credit) {
      throw new ConflictException({
        code: 'ACCOUNTING_LINE_INVALID',
        message: 'Each journal line must contain one positive debit or one positive credit.',
      });
    }
    totalDebit += debit;
    totalCredit += credit;
  }

  if (totalDebit <= 0n || totalDebit !== totalCredit) {
    throw new ConflictException({
      code: 'ACCOUNTING_ENTRY_NOT_BALANCED',
      message: 'Total debit must equal total credit before an entry can be posted.',
      details: {
        totalDebit: formatScaledInteger(totalDebit),
        totalCredit: formatScaledInteger(totalCredit),
        difference: formatScaledInteger(totalDebit - totalCredit),
      },
    });
  }
  return {
    totalDebit: formatScaledInteger(totalDebit),
    totalCredit: formatScaledInteger(totalCredit),
  };
}

function toScaledInteger(value: string | { toString(): string }): bigint {
  const raw = value.toString();
  const match = /^(-?)(\d+)(?:\.(\d{1,4}))?$/.exec(raw);
  if (!match) {
    throw new ConflictException({
      code: 'ACCOUNTING_LINE_INVALID',
      message: 'Journal line amounts must use at most four decimal places.',
    });
  }
  const scaled = BigInt(match[2]) * 10_000n + BigInt((match[3] ?? '').padEnd(4, '0'));
  return match[1] === '-' ? -scaled : scaled;
}

function formatScaledInteger(value: bigint): string {
  const sign = value < 0n ? '-' : '';
  const absolute = value < 0n ? -value : value;
  return `${sign}${absolute / 10_000n}.${(absolute % 10_000n).toString().padStart(4, '0')}`;
}
