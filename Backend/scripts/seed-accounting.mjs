import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

/**
 * Accounting Seed — deterministic, double-entry, multi-month hotel dataset.
 *
 * Produces a valid, balanced accounting dataset for reporting:
 *   - 3 full months of activity (Jan–Mar of the current fiscal year)
 *   - Owner capital, bank deposit, room revenue (cash + AR), AR collection,
 *     restaurant revenue, inventory purchase, supplier payment, COGS,
 *     salaries, utilities, rent, maintenance
 *   - Every journal entry satisfies  Dr == Cr
 *
 * Usage:
 *   node scripts/seed-accounting.mjs [--hotel-code=XXX] [--reset-existing]
 */

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, ...rest] = a.slice(2).split('=');
      return [k, rest.length ? rest.join('=') : 'true'];
    }),
);

const hotelCodeArg = (args['hotel-code'] ?? args.hotel ?? '').trim();
const resetExisting = args['reset-existing'] === 'true' || args['reset-existing'] === '1';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/* ─── Chart of Accounts ────────────────────────────────────────────── */

const ACCOUNTS = [
  // [code, name, type, normalBalance, parentCode, allowManualPosting, subType]
  // Assets
  ['1000', 'Assets', 'ASSET', 'DEBIT', null, false, null],
  ['1100', 'Cash and Cash Equivalents', 'ASSET', 'DEBIT', '1000', false, 'current_asset'],
  ['1110', 'Front Desk Cash', 'ASSET', 'DEBIT', '1100', true, 'current_asset'],
  ['1120', 'Bank Account', 'ASSET', 'DEBIT', '1100', true, 'current_asset'],
  ['1130', 'Mobile Money', 'ASSET', 'DEBIT', '1100', true, 'current_asset'],
  ['1200', 'Guest Accounts Receivable', 'ASSET', 'DEBIT', '1000', true, 'receivable'],
  ['1300', 'Inventory', 'ASSET', 'DEBIT', '1000', false, 'current_asset'],
  ['1310', 'Food & Beverage Inventory', 'ASSET', 'DEBIT', '1300', true, 'current_asset'],
  ['1400', 'Property and Equipment', 'ASSET', 'DEBIT', '1000', false, 'fixed_asset'],
  ['1410', 'Furniture and Fixtures', 'ASSET', 'DEBIT', '1400', false, 'fixed_asset'],

  // Liabilities
  ['2000', 'Liabilities', 'LIABILITY', 'CREDIT', null, false, null],
  ['2100', 'Accounts Payable', 'LIABILITY', 'CREDIT', '2000', true, 'payable'],
  ['2160', 'Salaries Payable', 'LIABILITY', 'CREDIT', '2000', false, 'accrual'],
  ['2200', 'Guest Deposits', 'LIABILITY', 'CREDIT', '2000', false, 'customer_deposit'],
  ['2300', 'Taxes Payable', 'LIABILITY', 'CREDIT', '2000', false, 'tax'],

  // Equity
  ['3000', 'Equity', 'EQUITY', 'CREDIT', null, false, null],
  ['3100', 'Owner Equity', 'EQUITY', 'CREDIT', '3000', true, null],
  ['3200', 'Retained Earnings', 'EQUITY', 'CREDIT', '3000', false, null],

  // Revenue
  ['4000', 'Revenue', 'REVENUE', 'CREDIT', null, false, null],
  ['4100', 'Room Revenue', 'REVENUE', 'CREDIT', '4000', true, 'operation'],
  ['4200', 'Restaurant Revenue', 'REVENUE', 'CREDIT', '4000', true, 'operation'],

  // Cost of Sales
  ['5000', 'Cost of Sales', 'EXPENSE', 'DEBIT', null, true, 'cost_of_sales'],
  ['5100', 'Food & Beverage Cost', 'EXPENSE', 'DEBIT', '5000', true, 'cost_of_sales'],

  // Operating Expenses
  ['6000', 'Operating Expenses', 'EXPENSE', 'DEBIT', null, false, 'operation'],
  ['6100', 'Salaries and Wages', 'EXPENSE', 'DEBIT', '6000', true, 'operation'],
  ['6200', 'Electricity', 'EXPENSE', 'DEBIT', '6000', true, 'utility'],
  ['6300', 'Water', 'EXPENSE', 'DEBIT', '6000', true, 'utility'],
  ['6600', 'Maintenance and Repairs', 'EXPENSE', 'DEBIT', '6000', true, 'operation'],
  ['6700', 'Rent', 'EXPENSE', 'DEBIT', '6000', true, 'operation'],
];

const JOURNALS = [
  ['GEN', 'General Journal', 'GENERAL'],
  ['SALES', 'Sales Journal', 'SALES'],
  ['CASH', 'Cash Journal', 'CASH'],
  ['BANK', 'Bank Journal', 'BANK'],
  ['PURCHASE', 'Purchase Journal', 'PURCHASE'],
];

/* ─── Validation ───────────────────────────────────────────────────── */

function assertBalancedEntry(description, lines) {
  if (!Array.isArray(lines) || lines.length < 2) {
    throw new Error(`${description}: entry must have at least 2 lines.`);
  }
  let totalDebit = 0;
  let totalCredit = 0;
  for (const line of lines) {
    const debit = Number(line.debit ?? 0);
    const credit = Number(line.credit ?? 0);
    if (!Number.isFinite(debit) || !Number.isFinite(credit)) {
      throw new Error(`${description}: invalid numeric value for account ${line.accountCode}.`);
    }
    if (debit < 0 || credit < 0) {
      throw new Error(`${description}: negative value for account ${line.accountCode}.`);
    }
    if (debit > 0 && credit > 0) {
      throw new Error(`${description}: account ${line.accountCode} has both debit and credit.`);
    }
    if (debit === 0 && credit === 0) {
      throw new Error(`${description}: account ${line.accountCode} has zero debit and credit.`);
    }
    totalDebit += debit;
    totalCredit += credit;
  }
  if (totalDebit <= 0 || totalCredit <= 0) {
    throw new Error(`${description}: must have positive debit and credit totals.`);
  }
  if (Math.abs(totalDebit - totalCredit) > 0.0001) {
    throw new Error(
      `${description}: UNBALANCED — debit=${totalDebit.toFixed(4)}, credit=${totalCredit.toFixed(4)}`,
    );
  }
  return { totalDebit, totalCredit };
}

/* ─── Main ─────────────────────────────────────────────────────────── */

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.');
  }

  const client = await pool.connect();
  let entrySeq = 0;

  try {
    await client.query('BEGIN');

    /* ── Find hotel ─────────────────────────────────────────────── */
    const hotelResult = await client.query(
      `SELECT id, code, name, "currencyCode"
       FROM "Hotel" WHERE "isActive" = true
       ${hotelCodeArg ? 'AND code = $1' : ''}
       ORDER BY "createdAt" ASC LIMIT 1`,
      hotelCodeArg ? [hotelCodeArg.toUpperCase()] : [],
    );
    if (hotelResult.rowCount !== 1) {
      throw new Error(hotelCodeArg
        ? `No active hotel found for code ${hotelCodeArg}.`
        : 'No active hotel found in the database.');
    }
    const hotel = hotelResult.rows[0];
    const currency = hotel.currencyCode ?? 'USD';

    /* ── Find actor (first user) ────────────────────────────────── */
    const actorResult = await client.query(
      `SELECT id FROM "User" WHERE "hotelId" = $1 AND "deletedAt" IS NULL
       ORDER BY "createdAt" ASC LIMIT 1`,
      [hotel.id],
    );
    if (actorResult.rowCount !== 1) {
      throw new Error(`No active user for hotel ${hotel.code}. Bootstrap a user first.`);
    }
    const actorId = actorResult.rows[0].id;

    /* ── Reset ──────────────────────────────────────────────────── */
    if (resetExisting) {
      await client.query(`
        TRUNCATE "JournalLine", "JournalEntry", "FiscalPeriod",
                 "AccountingSettings", "AccountingJournal", "Account",
                 "AccountingSequence"
        RESTART IDENTITY CASCADE;
      `);
    }

    /* ── Chart of Accounts ──────────────────────────────────────── */
    const accountMap = new Map();
    const accountMeta = new Map();

    for (const [code, name, type, normalBalance, parentCode, allowManualPosting, subType] of ACCOUNTS) {
      accountMeta.set(code, { type, normalBalance, name });
      const parentId = parentCode ? accountMap.get(parentCode) : null;

      const existing = await client.query(
        `SELECT id, type, "normalBalance" FROM "Account" WHERE "hotelId" = $1 AND code = $2`,
        [hotel.id, code],
      );
      if (existing.rowCount === 1) {
        const acc = existing.rows[0];
        if (acc.type !== type || acc.normalBalance !== normalBalance) {
          throw new Error(`Account ${code} exists with incompatible properties.`);
        }
        accountMap.set(code, acc.id);
        continue;
      }

      const created = await client.query(
        `INSERT INTO "Account" (
          id, "hotelId", code, name, type, "subType", "normalBalance",
          "parentAccountId", currency, "allowManualPosting", "isActive", "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4::"AccountType", $5, $6::"NormalBalance",
          $7, $8, $9, true, now(), now()
        ) RETURNING id`,
        [hotel.id, code, name, type, subType, normalBalance, parentId, currency, allowManualPosting],
      );
      accountMap.set(code, created.rows[0].id);
    }

    /* ── Journals ───────────────────────────────────────────────── */
    for (const [code, name, type] of JOURNALS) {
      await client.query(
        `INSERT INTO "AccountingJournal" (id, "hotelId", code, name, type, "isActive", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4::"AccountingJournalType", true, now(), now())
         ON CONFLICT ("hotelId", code) DO NOTHING`,
        [hotel.id, code, name, type],
      );
    }

    const journalRows = await client.query(
      `SELECT id, code FROM "AccountingJournal" WHERE "hotelId" = $1 ORDER BY code`,
      [hotel.id],
    );
    const journalMap = new Map(journalRows.rows.map((j) => [j.code, j.id]));

    /* ── Fiscal Periods ─────────────────────────────────────────── */
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth() + 1;
    const fiscalYearStart = currentYear;
    const fiscalYearEnd = currentYear;

    const createdPeriods = [];
    for (let year = fiscalYearStart; year <= fiscalYearEnd; year++) {
      const monthLimit = year === currentYear ? currentMonth : 12;
      for (let month = 1; month <= monthLimit; month++) {
        const name = `${year}-${String(month).padStart(2, '0')}`;
        const start = new Date(Date.UTC(year, month - 1, 1));
        const end = new Date(Date.UTC(year, month, 0));
        const period = await client.query(
          `INSERT INTO "FiscalPeriod" (id, "hotelId", name, "startDate", "endDate", status, "isOpening", "createdAt", "updatedAt")
           VALUES (gen_random_uuid(), $1, $2, $3::date, $4::date, 'OPEN', false, now(), now())
           ON CONFLICT ("hotelId", name) DO UPDATE SET
             "startDate" = EXCLUDED."startDate", "endDate" = EXCLUDED."endDate",
             status = 'OPEN', "updatedAt" = now()
           RETURNING id, name`,
          [hotel.id, name, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)],
        );
        createdPeriods.push(period.rows[0]);
      }
    }
    const periodMap = new Map(createdPeriods.map((p) => [p.name, p.id]));

    /* ── Accounting Settings ────────────────────────────────────── */
    await client.query(
      `INSERT INTO "AccountingSettings" (
        id, "hotelId", "baseCurrency",
        "defaultRoomRevenueAccountId", "defaultGuestReceivableAccountId",
        "defaultCashAccountId", "defaultBankAccountId", "defaultMobileMoneyAccountId",
        "defaultDepositAccountId", "defaultTaxPayableAccountId",
        "defaultServiceRevenueAccountId", "defaultDiscountAccountId",
        "defaultExpenseAccountId", "defaultAccountsPayableAccountId",
        "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), $1, $2,
        $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now(), now()
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
        hotel.id, currency,
        accountMap.get('4100'), accountMap.get('1200'),
        accountMap.get('1110'), accountMap.get('1120'), accountMap.get('1130'),
        accountMap.get('2200'), accountMap.get('2300'),
        accountMap.get('4200'), accountMap.get('4100'),
        accountMap.get('6900') ?? accountMap.get('6100'), accountMap.get('2100'),
      ],
    );

    /* ── Helper: insert a posted journal entry ──────────────────── */
    const yearPnl = new Map();

    // Idempotency: check if seed entries already exist
    const seedSourceTypes = [
      'OPENING_BALANCE', 'BANK_TRANSFER', 'NIGHT_AUDIT', 'SALES_RESTAURANT',
      'CREDIT_PURCHASE', 'SUPPLIER_PAYMENT', 'COST_OF_SALES', 'PAYROLL',
      'OPERATING_EXPENSE', 'RENT_INSURANCE', 'RECEIVABLE_COLLECTION',
    ];
    const existingSeed = await client.query(
      `SELECT COUNT(*) AS cnt FROM "JournalEntry" WHERE "hotelId" = $1 AND "sourceType" = ANY($2)`,
      [hotel.id, seedSourceTypes],
    );
    const existingCount = Number(existingSeed.rows[0].cnt);
    let skippedInsert = false;
    if (existingCount > 0) {
      console.log(`  ${existingCount} seed entries already exist — skipping creation (use --reset-existing to recreate).`);
      skippedInsert = true;
    }

    function dayOfMonth(periodKey, day) {
      const [y, m] = periodKey.split('-').map(Number);
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      return new Date(Date.UTC(y, m - 1, Math.min(day, lastDay)));
    }

    async function insertEntry({ periodKey, journalCode, businessDate, sourceType, reference, description, lines }) {
      if (skippedInsert) return null;

      const periodId = periodMap.get(periodKey);
      if (!periodId) throw new Error(`No fiscal period for ${periodKey}`);

      entrySeq++;
      const [yearStr, monthStr] = periodKey.split('-');
      const entryNumber = `JE-${hotel.code}-${yearStr}${monthStr}-${String(entrySeq).padStart(4, '0')}`;
      const entryId = randomUUID();
      const postingDate = new Date(businessDate.getTime() + 12 * 3600_000);

      assertBalancedEntry(description, lines);

      await client.query(
        `INSERT INTO "JournalEntry" (
          id, "hotelId", "journalId", "entryNumber", "businessDate", "postingDate",
          "sourceType", reference, description, status, "fiscalPeriodId",
          "createdById", "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5::date, $6, $7, $8, $9, 'DRAFT', $10, $11, now(), now()
        )`,
        [entryId, hotel.id, journalMap.get(journalCode), entryNumber,
         businessDate.toISOString().slice(0, 10), postingDate,
         sourceType, reference ?? null, description, periodId, actorId],
      );

      for (const line of lines) {
        const accountId = accountMap.get(line.accountCode);
        if (!accountId) {
          throw new Error(`Unknown account ${line.accountCode} in "${description}"`);
        }
        const debit = Number(line.debit ?? 0);
        const credit = Number(line.credit ?? 0);

        await client.query(
          `INSERT INTO "JournalLine" (id, "journalEntryId", "accountId", description, debit, credit, currency, "createdAt")
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, now())`,
          [entryId, accountId, line.description ?? null, debit.toFixed(4), credit.toFixed(4), currency],
        );

        // Track P&L for year-end closing (not needed for 3-month seed, but kept for completeness)
        const meta = accountMeta.get(line.accountCode);
        if (meta && (meta.type === 'REVENUE' || meta.type === 'EXPENSE')) {
          const yr = Number(yearStr);
          if (!yearPnl.has(yr)) yearPnl.set(yr, new Map());
          const bucket = yearPnl.get(yr);
          bucket.set(line.accountCode, (bucket.get(line.accountCode) ?? 0) + (debit - credit));
        }
      }

      // Mark as POSTED
      await client.query(
        `UPDATE "JournalEntry" SET status = 'POSTED', "postedById" = $1, "postedAt" = $2, "updatedAt" = now() WHERE id = $3`,
        [actorId, postingDate, entryId],
      );

      return entryId;
    }

    /* ══════════════════════════════════════════════════════════════
       MONTH 1 — JANUARY
       ══════════════════════════════════════════════════════════════ */
    const jan = `${fiscalYearStart}-01`;

    // 1. Opening capital — owner invests $20,000
    await insertEntry({
      periodKey: jan, journalCode: 'GEN', businessDate: dayOfMonth(jan, 1),
      sourceType: 'OPENING_BALANCE', reference: 'CAP-001',
      description: 'Owner capital investment',
      lines: [
        { accountCode: '1110', debit: 20000, description: 'Cash from owner' },
        { accountCode: '3100', credit: 20000, description: 'Owner equity' },
      ],
    });

    // 2. Bank deposit — transfer $10,000 cash to bank
    await insertEntry({
      periodKey: jan, journalCode: 'BANK', businessDate: dayOfMonth(jan, 2),
      sourceType: 'BANK_TRANSFER', reference: 'DEP-001',
      description: 'Deposit cash into bank account',
      lines: [
        { accountCode: '1120', debit: 10000, description: 'Bank deposit' },
        { accountCode: '1110', credit: 10000, description: 'Cash reduced' },
      ],
    });

    // 3. Room revenue — cash
    await insertEntry({
      periodKey: jan, journalCode: 'SALES', businessDate: dayOfMonth(jan, 5),
      sourceType: 'NIGHT_AUDIT', reference: 'REV-ROOM-001',
      description: 'Room revenue — cash payments',
      lines: [
        { accountCode: '1110', debit: 3000, description: 'Cash received' },
        { accountCode: '4100', credit: 3000, description: 'Room revenue' },
      ],
    });

    // 4. Room revenue — on account (AR)
    await insertEntry({
      periodKey: jan, journalCode: 'SALES', businessDate: dayOfMonth(jan, 5),
      sourceType: 'NIGHT_AUDIT', reference: 'REV-ROOM-002',
      description: 'Room revenue — on account',
      lines: [
        { accountCode: '1200', debit: 2500, description: 'Guest receivable' },
        { accountCode: '4100', credit: 2500, description: 'Room revenue' },
      ],
    });

    // 5. Restaurant revenue — cash
    await insertEntry({
      periodKey: jan, journalCode: 'SALES', businessDate: dayOfMonth(jan, 7),
      sourceType: 'SALES_RESTAURANT', reference: 'REV-REST-001',
      description: 'Restaurant sales — cash',
      lines: [
        { accountCode: '1110', debit: 800, description: 'Cash received' },
        { accountCode: '4200', credit: 800, description: 'Restaurant revenue' },
      ],
    });

    // 6. Inventory purchase on credit
    await insertEntry({
      periodKey: jan, journalCode: 'PURCHASE', businessDate: dayOfMonth(jan, 10),
      sourceType: 'CREDIT_PURCHASE', reference: 'PUR-001',
      description: 'F&B inventory purchased on credit',
      lines: [
        { accountCode: '1310', debit: 1000, description: 'F&B inventory' },
        { accountCode: '2100', credit: 1000, description: 'Accounts payable' },
      ],
    });

    // 7. Supplier payment — pay $600 of the $1,000 payable
    await insertEntry({
      periodKey: jan, journalCode: 'BANK', businessDate: dayOfMonth(jan, 15),
      sourceType: 'SUPPLIER_PAYMENT', reference: 'PAY-SUP-001',
      description: 'Partial supplier payment',
      lines: [
        { accountCode: '2100', debit: 600, description: 'AP settled' },
        { accountCode: '1120', credit: 600, description: 'Bank payment' },
      ],
    });

    // 8. Cost of goods sold — consume inventory
    await insertEntry({
      periodKey: jan, journalCode: 'PURCHASE', businessDate: dayOfMonth(jan, 20),
      sourceType: 'COST_OF_SALES', reference: 'COGS-001',
      description: 'F&B inventory consumed',
      lines: [
        { accountCode: '5100', debit: 300, description: 'F&B cost of sales' },
        { accountCode: '1310', credit: 300, description: 'F&B inventory reduced' },
      ],
    });

    // 9. Salaries
    await insertEntry({
      periodKey: jan, journalCode: 'GEN', businessDate: dayOfMonth(jan, 25),
      sourceType: 'PAYROLL', reference: 'SAL-001',
      description: 'Staff salaries — January',
      lines: [
        { accountCode: '6100', debit: 2000, description: 'Salaries expense' },
        { accountCode: '1110', credit: 2000, description: 'Cash paid' },
      ],
    });

    // 10. Utilities — electricity
    await insertEntry({
      periodKey: jan, journalCode: 'PURCHASE', businessDate: dayOfMonth(jan, 28),
      sourceType: 'OPERATING_EXPENSE', reference: 'UTIL-001',
      description: 'Electricity bill — January',
      lines: [
        { accountCode: '6200', debit: 300, description: 'Electricity' },
        { accountCode: '1110', credit: 300, description: 'Cash paid' },
      ],
    });

    // 11. Utilities — water
    await insertEntry({
      periodKey: jan, journalCode: 'PURCHASE', businessDate: dayOfMonth(jan, 28),
      sourceType: 'OPERATING_EXPENSE', reference: 'UTIL-002',
      description: 'Water bill — January',
      lines: [
        { accountCode: '6300', debit: 200, description: 'Water' },
        { accountCode: '1110', credit: 200, description: 'Cash paid' },
      ],
    });

    // 12. Rent
    await insertEntry({
      periodKey: jan, journalCode: 'PURCHASE', businessDate: dayOfMonth(jan, 29),
      sourceType: 'RENT_INSURANCE', reference: 'RENT-001',
      description: 'Monthly rent — January',
      lines: [
        { accountCode: '6700', debit: 1500, description: 'Rent' },
        { accountCode: '1110', credit: 1500, description: 'Cash paid' },
      ],
    });

    /* ══════════════════════════════════════════════════════════════
       MONTH 2 — FEBRUARY
       ══════════════════════════════════════════════════════════════ */
    const feb = `${fiscalYearStart}-02`;

    // 13. Room revenue — cash
    await insertEntry({
      periodKey: feb, journalCode: 'SALES', businessDate: dayOfMonth(feb, 1),
      sourceType: 'NIGHT_AUDIT', reference: 'REV-ROOM-003',
      description: 'Room revenue — cash payments',
      lines: [
        { accountCode: '1110', debit: 4000, description: 'Cash received' },
        { accountCode: '4100', credit: 4000, description: 'Room revenue' },
      ],
    });

    // 14. Room revenue — on account (AR)
    await insertEntry({
      periodKey: feb, journalCode: 'SALES', businessDate: dayOfMonth(feb, 1),
      sourceType: 'NIGHT_AUDIT', reference: 'REV-ROOM-004',
      description: 'Room revenue — on account',
      lines: [
        { accountCode: '1200', debit: 3000, description: 'Guest receivable' },
        { accountCode: '4100', credit: 3000, description: 'Room revenue' },
      ],
    });

    // 15. Collect AR — customer pays the $2,500 January receivable
    await insertEntry({
      periodKey: feb, journalCode: 'CASH', businessDate: dayOfMonth(feb, 5),
      sourceType: 'RECEIVABLE_COLLECTION', reference: 'COL-001',
      description: 'Collection of January receivable',
      lines: [
        { accountCode: '1110', debit: 2500, description: 'Cash collected' },
        { accountCode: '1200', credit: 2500, description: 'AR settled' },
      ],
    });

    // 16. Restaurant revenue — cash
    await insertEntry({
      periodKey: feb, journalCode: 'SALES', businessDate: dayOfMonth(feb, 7),
      sourceType: 'SALES_RESTAURANT', reference: 'REV-REST-002',
      description: 'Restaurant sales — cash',
      lines: [
        { accountCode: '1110', debit: 1000, description: 'Cash received' },
        { accountCode: '4200', credit: 1000, description: 'Restaurant revenue' },
      ],
    });

    // 17. Restaurant revenue — on account
    await insertEntry({
      periodKey: feb, journalCode: 'SALES', businessDate: dayOfMonth(feb, 7),
      sourceType: 'SALES_RESTAURANT', reference: 'REV-REST-003',
      description: 'Restaurant sales — on account',
      lines: [
        { accountCode: '1200', debit: 500, description: 'Guest receivable' },
        { accountCode: '4200', credit: 500, description: 'Restaurant revenue' },
      ],
    });

    // 18. Inventory purchase on credit
    await insertEntry({
      periodKey: feb, journalCode: 'PURCHASE', businessDate: dayOfMonth(feb, 10),
      sourceType: 'CREDIT_PURCHASE', reference: 'PUR-002',
      description: 'F&B inventory purchased on credit',
      lines: [
        { accountCode: '1310', debit: 1200, description: 'F&B inventory' },
        { accountCode: '2100', credit: 1200, description: 'Accounts payable' },
      ],
    });

    // 19. Supplier payment — pay remaining $400 from Jan + $600 from Feb
    await insertEntry({
      periodKey: feb, journalCode: 'BANK', businessDate: dayOfMonth(feb, 15),
      sourceType: 'SUPPLIER_PAYMENT', reference: 'PAY-SUP-002',
      description: 'Supplier payment',
      lines: [
        { accountCode: '2100', debit: 1000, description: 'AP settled' },
        { accountCode: '1120', credit: 1000, description: 'Bank payment' },
      ],
    });

    // 20. Cost of goods sold
    await insertEntry({
      periodKey: feb, journalCode: 'PURCHASE', businessDate: dayOfMonth(feb, 20),
      sourceType: 'COST_OF_SALES', reference: 'COGS-002',
      description: 'F&B inventory consumed',
      lines: [
        { accountCode: '5100', debit: 400, description: 'F&B cost of sales' },
        { accountCode: '1310', credit: 400, description: 'F&B inventory reduced' },
      ],
    });

    // 21. Salaries
    await insertEntry({
      periodKey: feb, journalCode: 'GEN', businessDate: dayOfMonth(feb, 25),
      sourceType: 'PAYROLL', reference: 'SAL-002',
      description: 'Staff salaries — February',
      lines: [
        { accountCode: '6100', debit: 2200, description: 'Salaries expense' },
        { accountCode: '1110', credit: 2200, description: 'Cash paid' },
      ],
    });

    // 22. Electricity
    await insertEntry({
      periodKey: feb, journalCode: 'PURCHASE', businessDate: dayOfMonth(feb, 28),
      sourceType: 'OPERATING_EXPENSE', reference: 'UTIL-003',
      description: 'Electricity bill — February',
      lines: [
        { accountCode: '6200', debit: 320, description: 'Electricity' },
        { accountCode: '1110', credit: 320, description: 'Cash paid' },
      ],
    });

    // 23. Water
    await insertEntry({
      periodKey: feb, journalCode: 'PURCHASE', businessDate: dayOfMonth(feb, 28),
      sourceType: 'OPERATING_EXPENSE', reference: 'UTIL-004',
      description: 'Water bill — February',
      lines: [
        { accountCode: '6300', debit: 220, description: 'Water' },
        { accountCode: '1110', credit: 220, description: 'Cash paid' },
      ],
    });

    // 24. Rent
    await insertEntry({
      periodKey: feb, journalCode: 'PURCHASE', businessDate: dayOfMonth(feb, 28),
      sourceType: 'RENT_INSURANCE', reference: 'RENT-002',
      description: 'Monthly rent — February',
      lines: [
        { accountCode: '6700', debit: 1500, description: 'Rent' },
        { accountCode: '1110', credit: 1500, description: 'Cash paid' },
      ],
    });

    // 25. Maintenance
    await insertEntry({
      periodKey: feb, journalCode: 'PURCHASE', businessDate: dayOfMonth(feb, 27),
      sourceType: 'OPERATING_EXPENSE', reference: 'MAINT-001',
      description: 'Maintenance and repairs — February',
      lines: [
        { accountCode: '6600', debit: 300, description: 'Maintenance' },
        { accountCode: '1110', credit: 300, description: 'Cash paid' },
      ],
    });

    /* ══════════════════════════════════════════════════════════════
       MONTH 3 — MARCH
       ══════════════════════════════════════════════════════════════ */
    const mar = `${fiscalYearStart}-03`;

    // 26. Room revenue — cash
    await insertEntry({
      periodKey: mar, journalCode: 'SALES', businessDate: dayOfMonth(mar, 1),
      sourceType: 'NIGHT_AUDIT', reference: 'REV-ROOM-005',
      description: 'Room revenue — cash payments',
      lines: [
        { accountCode: '1110', debit: 5000, description: 'Cash received' },
        { accountCode: '4100', credit: 5000, description: 'Room revenue' },
      ],
    });

    // 27. Room revenue — on account (AR)
    await insertEntry({
      periodKey: mar, journalCode: 'SALES', businessDate: dayOfMonth(mar, 1),
      sourceType: 'NIGHT_AUDIT', reference: 'REV-ROOM-006',
      description: 'Room revenue — on account',
      lines: [
        { accountCode: '1200', debit: 3500, description: 'Guest receivable' },
        { accountCode: '4100', credit: 3500, description: 'Room revenue' },
      ],
    });

    // 28. Collect AR — customer pays $3,000
    await insertEntry({
      periodKey: mar, journalCode: 'CASH', businessDate: dayOfMonth(mar, 5),
      sourceType: 'RECEIVABLE_COLLECTION', reference: 'COL-002',
      description: 'Collection of February receivable',
      lines: [
        { accountCode: '1110', debit: 3000, description: 'Cash collected' },
        { accountCode: '1200', credit: 3000, description: 'AR settled' },
      ],
    });

    // 29. Restaurant revenue — cash
    await insertEntry({
      periodKey: mar, journalCode: 'SALES', businessDate: dayOfMonth(mar, 7),
      sourceType: 'SALES_RESTAURANT', reference: 'REV-REST-004',
      description: 'Restaurant sales — cash',
      lines: [
        { accountCode: '1110', debit: 1200, description: 'Cash received' },
        { accountCode: '4200', credit: 1200, description: 'Restaurant revenue' },
      ],
    });

    // 30. Restaurant revenue — on account
    await insertEntry({
      periodKey: mar, journalCode: 'SALES', businessDate: dayOfMonth(mar, 7),
      sourceType: 'SALES_RESTAURANT', reference: 'REV-REST-005',
      description: 'Restaurant sales — on account',
      lines: [
        { accountCode: '1200', debit: 600, description: 'Guest receivable' },
        { accountCode: '4200', credit: 600, description: 'Restaurant revenue' },
      ],
    });

    // 31. Inventory purchase on credit
    await insertEntry({
      periodKey: mar, journalCode: 'PURCHASE', businessDate: dayOfMonth(mar, 10),
      sourceType: 'CREDIT_PURCHASE', reference: 'PUR-003',
      description: 'F&B inventory purchased on credit',
      lines: [
        { accountCode: '1310', debit: 1500, description: 'F&B inventory' },
        { accountCode: '2100', credit: 1500, description: 'Accounts payable' },
      ],
    });

    // 32. Supplier payment — pay $1,200
    await insertEntry({
      periodKey: mar, journalCode: 'BANK', businessDate: dayOfMonth(mar, 15),
      sourceType: 'SUPPLIER_PAYMENT', reference: 'PAY-SUP-003',
      description: 'Supplier payment',
      lines: [
        { accountCode: '2100', debit: 1200, description: 'AP settled' },
        { accountCode: '1120', credit: 1200, description: 'Bank payment' },
      ],
    });

    // 33. Cost of goods sold
    await insertEntry({
      periodKey: mar, journalCode: 'PURCHASE', businessDate: dayOfMonth(mar, 20),
      sourceType: 'COST_OF_SALES', reference: 'COGS-003',
      description: 'F&B inventory consumed',
      lines: [
        { accountCode: '5100', debit: 500, description: 'F&B cost of sales' },
        { accountCode: '1310', credit: 500, description: 'F&B inventory reduced' },
      ],
    });

    // 34. Salaries
    await insertEntry({
      periodKey: mar, journalCode: 'GEN', businessDate: dayOfMonth(mar, 25),
      sourceType: 'PAYROLL', reference: 'SAL-003',
      description: 'Staff salaries — March',
      lines: [
        { accountCode: '6100', debit: 2400, description: 'Salaries expense' },
        { accountCode: '1110', credit: 2400, description: 'Cash paid' },
      ],
    });

    // 35. Electricity
    await insertEntry({
      periodKey: mar, journalCode: 'PURCHASE', businessDate: dayOfMonth(mar, 28),
      sourceType: 'OPERATING_EXPENSE', reference: 'UTIL-005',
      description: 'Electricity bill — March',
      lines: [
        { accountCode: '6200', debit: 350, description: 'Electricity' },
        { accountCode: '1110', credit: 350, description: 'Cash paid' },
      ],
    });

    // 36. Water
    await insertEntry({
      periodKey: mar, journalCode: 'PURCHASE', businessDate: dayOfMonth(mar, 28),
      sourceType: 'OPERATING_EXPENSE', reference: 'UTIL-006',
      description: 'Water bill — March',
      lines: [
        { accountCode: '6300', debit: 240, description: 'Water' },
        { accountCode: '1110', credit: 240, description: 'Cash paid' },
      ],
    });

    // 37. Rent
    await insertEntry({
      periodKey: mar, journalCode: 'PURCHASE', businessDate: dayOfMonth(mar, 29),
      sourceType: 'RENT_INSURANCE', reference: 'RENT-003',
      description: 'Monthly rent — March',
      lines: [
        { accountCode: '6700', debit: 1500, description: 'Rent' },
        { accountCode: '1110', credit: 1500, description: 'Cash paid' },
      ],
    });

    // 38. Maintenance
    await insertEntry({
      periodKey: mar, journalCode: 'PURCHASE', businessDate: dayOfMonth(mar, 27),
      sourceType: 'OPERATING_EXPENSE', reference: 'MAINT-002',
      description: 'Maintenance and repairs — March',
      lines: [
        { accountCode: '6600', debit: 400, description: 'Maintenance' },
        { accountCode: '1110', credit: 400, description: 'Cash paid' },
      ],
    });

    /* ── Close non-current periods ──────────────────────────────── */
    const currentPeriodKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    await client.query(
      `UPDATE "FiscalPeriod" SET status = 'CLOSED', "updatedAt" = now()
       WHERE "hotelId" = $1 AND name <> $2 AND status = 'OPEN'`,
      [hotel.id, currentPeriodKey],
    );

    /* ══════════════════════════════════════════════════════════════
       VERIFICATION QUERIES
       ══════════════════════════════════════════════════════════════ */

    // Counts
    const countsResult = await client.query(
      `SELECT
         (SELECT COUNT(*) FROM "Account" WHERE "hotelId" = $1) AS account_count,
         (SELECT COUNT(*) FROM "JournalEntry" WHERE "hotelId" = $1) AS entry_count,
         (SELECT COUNT(*) FROM "JournalLine" jl
          JOIN "JournalEntry" je ON je.id = jl."journalEntryId"
          WHERE je."hotelId" = $1) AS line_count,
         (SELECT COUNT(*) FROM "JournalEntry" WHERE "hotelId" = $1 AND status = 'POSTED') AS posted_count`,
      [hotel.id],
    );
    const counts = countsResult.rows[0];

    // Trial Balance — sum of all debits vs credits
    const trialBalance = await client.query(
      `SELECT
         coalesce(sum(jl.debit), 0) AS total_debit,
         coalesce(sum(jl.credit), 0) AS total_credit
       FROM "JournalLine" jl
       JOIN "JournalEntry" je ON je.id = jl."journalEntryId"
       WHERE je."hotelId" = $1 AND je.status = 'POSTED'`,
      [hotel.id],
    );
    const tb = trialBalance.rows[0];
    const totalDebit = Number(tb.total_debit);
    const totalCredit = Number(tb.total_credit);
    const tbBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

    // Account balances for reporting
    const balances = await client.query(
      `SELECT a.code, a.name, a.type, a."normalBalance",
         coalesce(sum(jl.debit), 0) AS total_debit,
         coalesce(sum(jl.credit), 0) AS total_credit,
         CASE WHEN a."normalBalance" = 'DEBIT'
           THEN coalesce(sum(jl.debit), 0) - coalesce(sum(jl.credit), 0)
           ELSE coalesce(sum(jl.credit), 0) - coalesce(sum(jl.debit), 0)
         END AS balance
       FROM "Account" a
       LEFT JOIN "JournalLine" jl ON jl."accountId" = a.id
       LEFT JOIN "JournalEntry" je ON je.id = jl."journalEntryId" AND je.status = 'POSTED'
       WHERE a."hotelId" = $1
       GROUP BY a.id
       ORDER BY a.code`,
      [hotel.id],
    );

    const balMap = new Map(balances.rows.map((r) => [r.code, {
      name: r.name, type: r.type, normalBalance: r.normalBalance,
      totalDebit: Number(r.total_debit), totalCredit: Number(r.total_credit),
      balance: Number(r.balance),
    }]));

    // Revenue
    const revenue = ['4100', '4200'].reduce((sum, code) => sum + (balMap.get(code)?.balance ?? 0), 0);

    // COGS
    const cogs = balMap.get('5100')?.balance ?? 0;

    // Expenses
    const expenses = ['6100', '6200', '6300', '6600', '6700'].reduce(
      (sum, code) => sum + (balMap.get(code)?.balance ?? 0), 0,
    );

    const totalExpenses = cogs + expenses;
    const netProfit = revenue - totalExpenses;

    // Assets
    const cash = balMap.get('1110')?.balance ?? 0;
    const bank = balMap.get('1120')?.balance ?? 0;
    const ar = balMap.get('1200')?.balance ?? 0;
    const inventory = balMap.get('1310')?.balance ?? 0;
    const totalAssets = cash + bank + ar + inventory;

    // Liabilities
    const ap = balMap.get('2100')?.balance ?? 0;
    const deposits = balMap.get('2200')?.balance ?? 0;
    const totalLiabilities = ap + deposits;

    // Equity
    const ownerEquity = balMap.get('3100')?.balance ?? 0;
    const totalEquity = ownerEquity + netProfit;

    const bsBalanced = Math.abs(totalAssets - totalLiabilities - totalEquity) < 0.01;

    /* ── Commit ─────────────────────────────────────────────────── */
    await client.query('COMMIT');

    /* ── Print Summary ──────────────────────────────────────────── */
    const pad = (s, n) => String(s).padStart(n);
    const money = (v) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    console.log('');
    console.log('========================================');
    console.log('ACCOUNTING SEED COMPLETE');
    console.log('========================================');
    console.log(`Hotel:                 ${hotel.code} (${hotel.name})`);
    console.log(`Accounts:              ${counts.account_count}`);
    console.log(`Journal Entries:       ${counts.entry_count} (${counts.posted_count} posted)`);
    console.log(`Journal Lines:         ${counts.line_count}`);
    console.log('');
    console.log(`Total Debits:          ${money(totalDebit)}`);
    console.log(`Total Credits:         ${money(totalCredit)}`);
    console.log(`Trial Balance:         ${tbBalanced ? 'BALANCED' : 'NOT BALANCED — DIFFERENCE ' + money(Math.abs(totalDebit - totalCredit))}`);
    console.log('');
    console.log(`Revenue:               ${money(revenue)}`);
    console.log(`  Room Revenue:        ${money(balMap.get('4100')?.balance ?? 0)}`);
    console.log(`  Restaurant Revenue:  ${money(balMap.get('4200')?.balance ?? 0)}`);
    console.log('');
    console.log(`Cost of Goods Sold:    ${money(cogs)}`);
    console.log(`Operating Expenses:    ${money(expenses)}`);
    console.log(`  Salaries:            ${money(balMap.get('6100')?.balance ?? 0)}`);
    console.log(`  Electricity:         ${money(balMap.get('6200')?.balance ?? 0)}`);
    console.log(`  Water:               ${money(balMap.get('6300')?.balance ?? 0)}`);
    console.log(`  Maintenance:         ${money(balMap.get('6600')?.balance ?? 0)}`);
    console.log(`  Rent:                ${money(balMap.get('6700')?.balance ?? 0)}`);
    console.log('');
    console.log(`Net Profit:            ${money(netProfit)}`);
    console.log('');
    console.log(`--- Balance Sheet ---`);
    console.log(`Assets:`);
    console.log(`  Cash:                ${money(cash)}`);
    console.log(`  Bank:                ${money(bank)}`);
    console.log(`  Accounts Receivable: ${money(ar)}`);
    console.log(`  Inventory:           ${money(inventory)}`);
    console.log(`  Total Assets:        ${money(totalAssets)}`);
    console.log('');
    console.log(`Liabilities:`);
    console.log(`  Accounts Payable:    ${money(ap)}`);
    console.log(`  Customer Deposits:   ${money(deposits)}`);
    console.log(`  Total Liabilities:   ${money(totalLiabilities)}`);
    console.log('');
    console.log(`Equity:`);
    console.log(`  Owner's Equity:      ${money(ownerEquity)}`);
    console.log(`  Current P&L:         ${money(netProfit)}`);
    console.log(`  Total Equity:        ${money(totalEquity)}`);
    console.log('');
    console.log(`Balance Sheet:         ${bsBalanced ? 'BALANCED' : 'NOT BALANCED — DIFFERENCE ' + money(Math.abs(totalAssets - totalLiabilities - totalEquity))}`);
    console.log('========================================');

    if (!tbBalanced || !bsBalanced) {
      console.error('SEED VALIDATION FAILED — accounting equations do not balance!');
      process.exitCode = 1;
    }
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
  console.error('Accounting seed failed:', error.message);
  process.exitCode = 1;
}
