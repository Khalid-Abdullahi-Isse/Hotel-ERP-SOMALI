import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((argument) => argument.startsWith('--'))
    .map((argument) => {
      const [rawKey, ...rawParts] = argument.slice(2).split('=');
      const key = rawKey.trim();
      const value = rawParts.length ? rawParts.join('=') : 'true';
      return [key, value];
    }),
);

const hotelCode = (args['hotel-code'] ?? args.hotel ?? '').trim();
const resetExisting = args['reset-existing'] === 'true' || args['reset-existing'] === '1';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const DEFAULT_ACCOUNTS = [
  ['1000', 'Assets', 'ASSET', 'DEBIT', null, false],
  ['1100', 'Cash and Cash Equivalents', 'ASSET', 'DEBIT', '1000', false],
  ['1110', 'Front Desk Cash', 'ASSET', 'DEBIT', '1100', true],
  ['1120', 'Bank', 'ASSET', 'DEBIT', '1100', true],
  ['1130', 'Mobile Money', 'ASSET', 'DEBIT', '1100', true],
  ['1200', 'Guest Accounts Receivable', 'ASSET', 'DEBIT', '1000', true],
  ['2000', 'Liabilities', 'LIABILITY', 'CREDIT', null, false],
  ['2100', 'Accounts Payable', 'LIABILITY', 'CREDIT', '2000', true],
  ['2200', 'Guest Deposits', 'LIABILITY', 'CREDIT', '2000', false],
  ['2300', 'Taxes Payable', 'LIABILITY', 'CREDIT', '2000', false],
  ['3000', 'Equity', 'EQUITY', 'CREDIT', null, false],
  ['3100', 'Owner Equity', 'EQUITY', 'CREDIT', '3000', true],
  ['3200', 'Retained Earnings', 'EQUITY', 'CREDIT', '3000', false],
  ['4000', 'Revenue', 'REVENUE', 'CREDIT', null, false],
  ['4090', 'Sales Discounts', 'REVENUE', 'DEBIT', '4000', false],
  ['4100', 'Room Revenue', 'REVENUE', 'CREDIT', '4000', false],
  ['4200', 'Restaurant Revenue', 'REVENUE', 'CREDIT', '4000', false],
  ['4300', 'Laundry Revenue', 'REVENUE', 'CREDIT', '4000', false],
  ['4400', 'Transport Revenue', 'REVENUE', 'CREDIT', '4000', false],
  ['4500', 'Other Revenue', 'REVENUE', 'CREDIT', '4000', false],
  ['5000', 'Cost of Sales', 'EXPENSE', 'DEBIT', null, true],
  ['6000', 'Operating Expenses', 'EXPENSE', 'DEBIT', null, false],
  ['6100', 'Salaries', 'EXPENSE', 'DEBIT', '6000', true],
  ['6200', 'Electricity', 'EXPENSE', 'DEBIT', '6000', true],
  ['6300', 'Water', 'EXPENSE', 'DEBIT', '6000', true],
  ['6400', 'Internet', 'EXPENSE', 'DEBIT', '6000', true],
  ['6500', 'Cleaning', 'EXPENSE', 'DEBIT', '6000', true],
  ['6600', 'Maintenance', 'EXPENSE', 'DEBIT', '6000', true],
  ['6700', 'Rent', 'EXPENSE', 'DEBIT', '6000', true],
  ['6800', 'Marketing', 'EXPENSE', 'DEBIT', '6000', true],
  ['6900', 'Other Expenses', 'EXPENSE', 'DEBIT', '6000', true],
];

const DEFAULT_JOURNALS = [
  ['GEN', 'General Journal', 'GENERAL'],
  ['SALES', 'Sales Journal', 'SALES'],
  ['CASH', 'Cash Journal', 'CASH'],
  ['BANK', 'Bank Journal', 'BANK'],
  ['MOBILE', 'Mobile Money Journal', 'MOBILE_MONEY'],
  ['PURCHASE', 'Purchase Journal', 'PURCHASE'],
  ['ADJUST', 'Adjustment Journal', 'ADJUSTMENT'],
  ['NIGHT', 'Night Audit Journal', 'NIGHT_AUDIT'],
];

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const hotelQuery = `
      SELECT id, code, name, "currencyCode"
      FROM "Hotel"
      WHERE "isActive" = true
      ${hotelCode ? 'AND code = $1' : ''}
      ORDER BY "createdAt" ASC
      LIMIT 1
    `;
    const hotelResult = await client.query(hotelQuery, hotelCode ? [hotelCode.toUpperCase()] : []);
    if (hotelResult.rowCount !== 1) {
      throw new Error(hotelCode ? `No active hotel found for code ${hotelCode}.` : 'No active hotel found in the database.');
    }

    const hotel = hotelResult.rows[0];
    const actor = await client.query(
      `SELECT id FROM "User" WHERE "hotelId" = $1 AND "deletedAt" IS NULL ORDER BY "createdAt" ASC LIMIT 1`,
      [hotel.id],
    );
    if (actor.rowCount !== 1) {
      throw new Error(`No active user exists for hotel ${hotel.code}. Create at least one user first.`);
    }
    const actorId = actor.rows[0].id;

    if (resetExisting) {
      await client.query(`
        TRUNCATE "JournalLine",
                 "JournalEntry",
                 "FiscalPeriod",
                 "AccountingSettings",
                 "AccountingJournal",
                 "Account",
                 "AccountingSequence"
        RESTART IDENTITY CASCADE;
      `);
    }

    const accountMap = new Map();
    for (const [code, name, type, normalBalance, parentCode, allowManualPosting] of DEFAULT_ACCOUNTS) {
      const parentId = parentCode ? accountMap.get(parentCode) : null;
      const existing = await client.query(
        `SELECT id, type, "normalBalance" FROM "Account" WHERE "hotelId" = $1 AND code = $2`,
        [hotel.id, code],
      );

      if (existing.rowCount === 1) {
        const account = existing.rows[0];
        if (account.type !== type || account.normalBalance !== normalBalance) {
          throw new Error(`Account ${code} exists with incompatible accounting properties.`);
        }
        accountMap.set(code, account.id);
        continue;
      }

      const created = await client.query(
        `INSERT INTO "Account" (
          id, "hotelId", code, name, type, "normalBalance", "parentAccountId", currency,
          "allowManualPosting", "isActive", "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4::"AccountType", $5::"NormalBalance", $6, $7, $8, true, now(), now()
        ) RETURNING id`,
        [hotel.id, code, name, type, normalBalance, parentId, hotel.currencyCode ?? 'USD', allowManualPosting],
      );
      accountMap.set(code, created.rows[0].id);
    }

    for (const [code, name, type] of DEFAULT_JOURNALS) {
      await client.query(
        `INSERT INTO "AccountingJournal" (id, "hotelId", code, name, type, "isActive", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4::"AccountingJournalType", true, now(), now())
         ON CONFLICT ("hotelId", code) DO NOTHING`,
        [hotel.id, code, name, type],
      );
    }

    const journalRows = await client.query(
      `SELECT id, code FROM "AccountingJournal" WHERE "hotelId" = $1 ORDER BY code ASC`,
      [hotel.id],
    );
    const journalMap = new Map(journalRows.rows.map((journal) => [journal.code, journal.id]));

    await client.query(
      `INSERT INTO "AccountingSettings" (
         id, "hotelId", "baseCurrency",
         "defaultRoomRevenueAccountId", "defaultGuestReceivableAccountId", "defaultCashAccountId",
         "defaultBankAccountId", "defaultMobileMoneyAccountId", "defaultDepositAccountId",
         "defaultTaxPayableAccountId", "defaultServiceRevenueAccountId", "defaultDiscountAccountId",
         "defaultExpenseAccountId", "defaultAccountsPayableAccountId", "createdAt", "updatedAt"
      ) VALUES (
         gen_random_uuid(), $1, $2,
         $3, $4, $5,
         $6, $7, $8,
         $9, $10, $11,
         $12, $13, now(), now()
      ) ON CONFLICT ("hotelId") DO UPDATE SET
         "baseCurrency" = EXCLUDED."baseCurrency",
         "defaultRoomRevenueAccountId" = EXCLUDED."defaultRoomRevenueAccountId",
         "defaultGuestReceivableAccountId" = EXCLUDED."defaultGuestReceivableAccountId",
         "defaultCashAccountId" = EXCLUDED."defaultCashAccountId",
         "defaultBankAccountId" = EXCLUDED."defaultBankAccountId",
         "defaultMobileMoneyAccountId" = EXCLUDED."defaultMobileMoneyAccountId",
         "defaultDepositAccountId" = EXCLUDED."defaultDepositAccountId",
         "defaultTaxPayableAccountId" = EXCLUDED."defaultTaxPayableAccountId",
         "defaultServiceRevenueAccountId" = EXCLUDED."defaultServiceRevenueAccountId",
         "defaultDiscountAccountId" = EXCLUDED."defaultDiscountAccountId",
         "defaultExpenseAccountId" = EXCLUDED."defaultExpenseAccountId",
         "defaultAccountsPayableAccountId" = EXCLUDED."defaultAccountsPayableAccountId",
         "updatedAt" = now()`,
      [
        hotel.id,
        hotel.currencyCode ?? 'USD',
        accountMap.get('4100'),
        accountMap.get('1200'),
        accountMap.get('1110'),
        accountMap.get('1120'),
        accountMap.get('1130'),
        accountMap.get('2200'),
        accountMap.get('2300'),
        accountMap.get('4500'),
        accountMap.get('4090'),
        accountMap.get('6900'),
        accountMap.get('2100'),
      ],
    );

    const currentDate = new Date();
    const currentYear = currentDate.getUTCFullYear();
    const currentMonth = currentDate.getUTCMonth() + 1;
    const startYear = currentYear - 2;
    const insertedPeriods = [];

    for (let year = startYear; year <= currentYear; year += 1) {
      for (let month = 1; month <= 12; month += 1) {
        if (year === currentYear && month > currentMonth) break;
        const name = `${year}-${String(month).padStart(2, '0')}`;
        const start = new Date(Date.UTC(year, month - 1, 1));
        const end = new Date(Date.UTC(year, month, 0));
        const period = await client.query(
          `INSERT INTO "FiscalPeriod" (id, "hotelId", name, "startDate", "endDate", status, "isOpening", "createdAt", "updatedAt")
           VALUES (gen_random_uuid(), $1, $2, $3::date, $4::date, 'OPEN', false, now(), now())
           ON CONFLICT ("hotelId", name) DO UPDATE SET
             "startDate" = EXCLUDED."startDate",
             "endDate" = EXCLUDED."endDate",
             status = 'OPEN',
             "updatedAt" = now()
           RETURNING id, name`,
          [hotel.id, name, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)],
        );
        insertedPeriods.push(period.rows[0]);
      }
    }

    const periodMap = new Map(insertedPeriods.map((period) => [period.name, period.id]));
    let entrySequence = 1;

    for (const [name, periodId] of periodMap.entries()) {
      const [yearPart, monthPart] = name.split('-').map(Number);
      const monthIndex = monthPart - 1;
      const roomRevenue = 8400 + ((yearPart - startYear) * 250) + monthIndex * 210 + (((monthIndex + 1) * 137) % 900);
      const serviceRevenue = 1800 + monthIndex * 90 + ((monthIndex + 1) * 57 % 500);
      const totalRevenue = roomRevenue + serviceRevenue;

      const revenueEntryId = randomUUID();
      const revenueBusinessDate = new Date(Date.UTC(yearPart, monthIndex, 16));
      const revenuePostingDate = new Date(revenueBusinessDate.getTime() + 24 * 60 * 60 * 1000);
      const revenueEntryNumber = `JE-${hotel.code}-${yearPart}${String(monthPart).padStart(2, '0')}-${String(entrySequence++).padStart(4, '0')}`;

      await client.query(
        `INSERT INTO "JournalEntry" (
          id, "hotelId", "journalId", "entryNumber", "businessDate", "postingDate", "sourceType",
          description, status, "fiscalPeriodId", "createdById", "postedById", "postedAt",
          "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5::date, $6, 'SEED', $7, 'DRAFT', $8, $9, NULL, NULL, now(), now()
        )`,
        [
          revenueEntryId,
          hotel.id,
          journalMap.get('GEN'),
          revenueEntryNumber,
          revenueBusinessDate.toISOString().slice(0, 10),
          revenuePostingDate,
          `Revenue posting for ${MONTH_NAMES[monthIndex]} ${yearPart}`,
          periodId,
          actorId,
        ],
      );

      await client.query(
        `INSERT INTO "JournalLine" (id, "journalEntryId", "accountId", description, debit, credit, currency, "createdAt")
         VALUES
           (gen_random_uuid(), $1, $2, 'Cash receipts', $3, 0, $4, now()),
           (gen_random_uuid(), $1, $5, 'Room revenue', 0, $6, $4, now()),
           (gen_random_uuid(), $1, $7, 'Other revenue', 0, $8, $4, now())`,
        [
          revenueEntryId,
          accountMap.get('1110'),
          totalRevenue,
          hotel.currencyCode ?? 'USD',
          accountMap.get('4100'),
          roomRevenue,
          accountMap.get('4500'),
          serviceRevenue,
        ],
      );

      await client.query(
        `UPDATE "JournalEntry"
         SET status = 'POSTED', "postedById" = $1, "postedAt" = $2, "updatedAt" = now()
         WHERE id = $3`,
        [actorId, revenuePostingDate, revenueEntryId],
      );

      const salaryExpense = 4300 + monthIndex * 120 + (yearPart * 17) % 600;
      const electricityExpense = 980 + monthIndex * 55;
      const cleaningExpense = 700 + monthIndex * 45 + (monthIndex % 3) * 60;
      const totalExpense = salaryExpense + electricityExpense + cleaningExpense;
      const expenseEntryId = randomUUID();
      const expenseBusinessDate = new Date(Date.UTC(yearPart, monthIndex, 22));
      const expensePostingDate = new Date(expenseBusinessDate.getTime() + 36 * 60 * 60 * 1000);
      const expenseEntryNumber = `JE-${hotel.code}-${yearPart}${String(monthPart).padStart(2, '0')}-${String(entrySequence++).padStart(4, '0')}`;

      await client.query(
        `INSERT INTO "JournalEntry" (
           id, "hotelId", "journalId", "entryNumber", "businessDate", "postingDate", "sourceType",
           description, status, "fiscalPeriodId", "createdById", "postedById", "postedAt",
           "createdAt", "updatedAt"
         ) VALUES (
           $1, $2, $3, $4, $5::date, $6, 'SEED', $7, 'DRAFT', $8, $9, NULL, NULL, now(), now()
         )`,
        [
          expenseEntryId,
          hotel.id,
          journalMap.get('PURCHASE'),
          expenseEntryNumber,
          expenseBusinessDate.toISOString().slice(0, 10),
          expensePostingDate,
          `Operating expenses for ${MONTH_NAMES[monthIndex]} ${yearPart}`,
          periodId,
          actorId,
        ],
      );

      await client.query(
        `INSERT INTO "JournalLine" (id, "journalEntryId", "accountId", description, debit, credit, currency, "createdAt")
         VALUES
           (gen_random_uuid(), $1, $2, 'Salaries', $3, 0, $4, now()),
           (gen_random_uuid(), $1, $5, 'Electricity', $6, 0, $4, now()),
           (gen_random_uuid(), $1, $7, 'Cleaning', $8, 0, $4, now()),
           (gen_random_uuid(), $1, $9, 'Cash payment', 0, $10, $4, now())`,
        [
          expenseEntryId,
          accountMap.get('6100'),
          salaryExpense,
          hotel.currencyCode ?? 'USD',
          accountMap.get('6200'),
          electricityExpense,
          accountMap.get('6500'),
          cleaningExpense,
          accountMap.get('1110'),
          totalExpense,
        ],
      );

      await client.query(
        `UPDATE "JournalEntry"
         SET status = 'POSTED', "postedById" = $1, "postedAt" = $2, "updatedAt" = now()
         WHERE id = $3`,
        [actorId, expensePostingDate, expenseEntryId],
      );
    }

    const monthName = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    await client.query(
      `UPDATE "FiscalPeriod"
       SET status = 'CLOSED', "updatedAt" = now()
       WHERE "hotelId" = $1 AND name <> $2 AND status = 'OPEN'`,
      [hotel.id, monthName],
    );

    const counts = await client.query(
      `SELECT
         (SELECT COUNT(*) FROM "Account" WHERE "hotelId" = $1) AS account_count,
         (SELECT COUNT(*) FROM "FiscalPeriod" WHERE "hotelId" = $1) AS fiscal_period_count,
         (SELECT COUNT(*) FROM "JournalEntry" WHERE "hotelId" = $1) AS journal_entry_count,
         (SELECT COUNT(*) FROM "JournalLine" jl JOIN "JournalEntry" je ON je.id = jl."journalEntryId" WHERE je."hotelId" = $1) AS journal_line_count`,
      [hotel.id],
    );

    await client.query('COMMIT');

    console.log(`Accounting seed complete for hotel ${hotel.code}.`);
    console.log(JSON.stringify({
      hotel: hotel.code,
      accountCount: Number(counts.rows[0].account_count),
      fiscalPeriodCount: Number(counts.rows[0].fiscal_period_count),
      journalEntryCount: Number(counts.rows[0].journal_entry_count),
      journalLineCount: Number(counts.rows[0].journal_line_count),
    }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

try {
  await main();
} catch (error) {
  console.error('Accounting seed failed.');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
