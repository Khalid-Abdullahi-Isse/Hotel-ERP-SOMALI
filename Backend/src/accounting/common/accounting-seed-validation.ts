export type SeedJournalEntryLine = {
  accountCode: string;
  debit: number | string;
  credit: number | string;
};

export function assertBalancedSeedEntry(lines: readonly SeedJournalEntryLine[]) {
  if (!Array.isArray(lines) || lines.length < 2) {
    throw new Error('Seed journal entry must contain at least two lines.');
  }

  let totalDebit = 0;
  let totalCredit = 0;

  for (const line of lines) {
    const accountCode = String(line.accountCode ?? '').trim();
    if (!accountCode) {
      throw new Error('Seed journal line is missing an account code.');
    }

    const debit = Number(line.debit ?? 0);
    const credit = Number(line.credit ?? 0);

    if (!Number.isFinite(debit) || !Number.isFinite(credit)) {
      throw new Error(`Seed journal line for ${accountCode} has an invalid numeric value.`);
    }
    if (debit < 0 || credit < 0) {
      throw new Error(`Seed journal line for ${accountCode} cannot include a negative debit or credit.`);
    }
    if (debit > 0 && credit > 0) {
      throw new Error(`Seed journal line for ${accountCode} cannot be both debited and credited.`);
    }
    if (debit === 0 && credit === 0) {
      throw new Error(`Seed journal line for ${accountCode} must have either a debit or a credit.`);
    }

    totalDebit += debit;
    totalCredit += credit;
  }

  if (totalDebit <= 0 || totalCredit <= 0) {
    throw new Error('Seed journal entry must include a positive debit and credit total.');
  }

  if (Math.abs(totalDebit - totalCredit) > 0.0001) {
    throw new Error(
      `Seed journal entry is unbalanced: debit=${totalDebit.toFixed(4)}, credit=${totalCredit.toFixed(4)}`,
    );
  }

  return { totalDebit, totalCredit };
}
