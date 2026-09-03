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
const historyYears = Number(args['history-years'] ?? 2);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const ACCOUNTS = [
  // [code, name, type, normalBalance, parentCode, allowManualPosting, subType]
  ['1000', 'Assets', 'ASSET', 'DEBIT', null, false, null],
  ['1100', 'Cash and Cash Equivalents', 'ASSET', 'DEBIT', '1000', false, 'current_asset'],
  ['1110', 'Front Desk Cash', 'ASSET', 'DEBIT', '1100', true, 'current_asset'],
  ['1120', 'Bank Account', 'ASSET', 'DEBIT', '1100', true, 'current_asset'],
  ['1130', 'Mobile Money', 'ASSET', 'DEBIT', '1100', true, 'current_asset'],
  ['1200', 'Guest Accounts Receivable', 'ASSET', 'DEBIT', '1000', true, 'receivable'],
  ['1210', 'Accounts Receivable - Corporate', 'ASSET', 'DEBIT', '1200', true, 'receivable'],
  ['1300', 'Inventory', 'ASSET', 'DEBIT', '1000', false, 'current_asset'],
  ['1310', 'Food & Beverage Inventory', 'ASSET', 'DEBIT', '1300', false, 'current_asset'],
  ['1320', 'Amenities & Supplies', 'ASSET', 'DEBIT', '1300', false, 'current_asset'],
  ['1400', 'Property and Equipment', 'ASSET', 'DEBIT', '1000', false, 'fixed_asset'],
  ['1410', 'Furniture and Fixtures', 'ASSET', 'DEBIT', '1400', false, 'fixed_asset'],
  ['1420', 'Kitchen Equipment', 'ASSET', 'DEBIT', '1400', false, 'fixed_asset'],
  ['1430', 'Vehicles', 'ASSET', 'DEBIT', '1400', false, 'fixed_asset'],
  ['1500', 'Accumulated Depreciation', 'ASSET', 'CREDIT', '1000', false, 'contra_asset'],
  ['1510', 'Accum Depr - Furniture', 'ASSET', 'CREDIT', '1500', false, 'contra_asset'],
  ['1520', 'Accum Depr - Kitchen Equipment', 'ASSET', 'CREDIT', '1500', false, 'contra_asset'],
  ['1530', 'Accum Depr - Vehicles', 'ASSET', 'CREDIT', '1500', false, 'contra_asset'],

  ['2000', 'Liabilities', 'LIABILITY', 'CREDIT', null, false, null],
  ['2100', 'Accounts Payable', 'LIABILITY', 'CREDIT', '2000', true, 'payable'],
  ['2150', 'Accrued Expenses', 'LIABILITY', 'CREDIT', '2000', false, 'accrual'],
  ['2160', 'Salaries Payable', 'LIABILITY', 'CREDIT', '2000', false, 'accrual'],
  ['2200', 'Guest Deposits', 'LIABILITY', 'CREDIT', '2000', false, 'customer_deposit'],
  ['2300', 'Taxes Payable', 'LIABILITY', 'CREDIT', '2000', false, 'tax'],
  ['2310', 'Sales Tax Payable', 'LIABILITY', 'CREDIT', '2300', false, 'tax'],
  ['2320', 'Payroll Tax Payable', 'LIABILITY', 'CREDIT', '2300', false, 'tax'],
  ['2400', 'Short-term Loans', 'LIABILITY', 'CREDIT', '2000', false, 'loan'],

  ['3000', 'Equity', 'EQUITY', 'CREDIT', null, false, null],
  ['3100', 'Owner Equity', 'EQUITY', 'CREDIT', '3000', true, null],
  ['3200', 'Retained Earnings', 'EQUITY', 'CREDIT', '3000', false, null],
  ['3300', 'Owner Drawings', 'EQUITY', 'DEBIT', '3000', false, null],

  ['4000', 'Revenue', 'REVENUE', 'CREDIT', null, false, null],
  ['4090', 'Sales Discounts', 'REVENUE', 'DEBIT', '4000', false, 'contra_revenue'],
  ['4100', 'Room Revenue', 'REVENUE', 'CREDIT', '4000', false, 'operation'],
  ['4200', 'Restaurant Revenue', 'REVENUE', 'CREDIT', '4000', false, 'operation'],
  ['4300', 'Laundry Revenue', 'REVENUE', 'CREDIT', '4000', false, 'operation'],
  ['4400', 'Transport Revenue', 'REVENUE', 'CREDIT', '4000', false, 'operation'],
  ['4500', 'Other Revenue', 'REVENUE', 'CREDIT', '4000', false, 'operation'],

  ['5000', 'Cost of Sales', 'EXPENSE', 'DEBIT', null, true, 'cost_of_sales'],
  ['5100', 'Food & Beverage Cost', 'EXPENSE', 'DEBIT', '5000', false, 'cost_of_sales'],
  ['5200', 'Amenities Cost', 'EXPENSE', 'DEBIT', '5000', false, 'cost_of_sales'],

  ['6000', 'Operating Expenses', 'EXPENSE', 'DEBIT', null, false, 'operation'],
  ['6100', 'Salaries and Wages', 'EXPENSE', 'DEBIT', '6000', true, 'operation'],
  ['6200', 'Electricity', 'EXPENSE', 'DEBIT', '6000', true, 'utility'],
  ['6300', 'Water', 'EXPENSE', 'DEBIT', '6000', true, 'utility'],
  ['6400', 'Internet and Communication', 'EXPENSE', 'DEBIT', '6000', true, 'utility'],
  ['6500', 'Cleaning and Laundry Supplies', 'EXPENSE', 'DEBIT', '6000', true, 'operation'],
  ['6600', 'Maintenance and Repairs', 'EXPENSE', 'DEBIT', '6000', true, 'operation'],
  ['6700', 'Rent', 'EXPENSE', 'DEBIT', '6000', true, 'operation'],
  ['6750', 'Insurance', 'EXPENSE', 'DEBIT', '6000', true, 'operation'],
  ['6800', 'Marketing and Advertising', 'EXPENSE', 'DEBIT', '6000', true, 'operation'],
  ['6850', 'Depreciation Expense', 'EXPENSE', 'DEBIT', '6000', false, 'operation'],
  ['6900', 'Other Expenses', 'EXPENSE', 'DEBIT', '6000', true, 'operation'],
  ['6950', 'Bank Charges and Fees', 'EXPENSE', 'DEBIT', '6000', true, 'operation'],
];

const JOURNALS = [
  ['GEN', 'General Journal', 'GENERAL'],
  ['SALES', 'Sales Journal', 'SALES'],
  ['CASH', 'Cash Journal', 'CASH'],
  ['BANK', 'Bank Journal', 'BANK'],
  ['MOBILE', 'Mobile Money Journal', 'MOBILE_MONEY'],
  ['PURCHASE', 'Purchase Journal', 'PURCHASE'],
  ['ADJUST', 'Adjustment Journal', 'ADJUSTMENT'],
  ['NIGHT', 'Night Audit Journal', 'NIGHT_AUDIT'],
];

function round2(value) {
  return Math.round(value * 100) / 100;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

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
    const currency = hotel.currencyCode ?? 'USD';

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

    // ---- Chart of Accounts ----
    const accountMap = new Map();
    const accountMeta = new Map();
    for (const [code, name, type, normalBalance, parentCode, allowManualPosting, subType] of ACCOUNTS) {
      accountMeta.set(code, { type, normalBalance });
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
          id, "hotelId", code, name, type, "subType", "normalBalance", "parentAccountId", currency,
          "allowManualPosting", "isActive", "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4::"AccountType", $5, $6::"NormalBalance", $7, $8, $9, true, now(), now()
        ) RETURNING id`,
        [hotel.id, code, name, type, subType, normalBalance, parentId, currency, allowManualPosting],
      );
      accountMap.set(code, created.rows[0].id);
    }

    // ---- Journals ----
    for (const [code, name, type] of JOURNALS) {
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

    // ---- Settings ----
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
        currency,
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

    // ---- Fiscal Periods ----
    const currentDate = new Date();
    const currentYear = currentDate.getUTCFullYear();
    const currentMonth = currentDate.getUTCMonth() + 1;
    const startYear = currentYear - historyYears;
    const createdPeriods = [];

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
        createdPeriods.push(period.rows[0]);
      }
    }
    const periodMap = new Map(createdPeriods.map((period) => [period.name, period.id]));
    const currentPeriodKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

    // ---- Journal Entry helpers (all posted, into an open period) ----
    let entrySequence = 1;

    function uniqueSource() {
      return randomUUID();
    }

    const yearPnl = new Map();

    async function insertEntry({ periodKey, journalCode, businessDate, sourceType, sourceId, reference, description, lines, postingOffsetHours = 12, reversedEntryId = null }) {
      const periodId = periodMap.get(periodKey);
      const entryId = randomUUID();
      const yearPart = Number(periodKey.slice(0, 4));
      const monthPart = Number(periodKey.slice(5, 7));
      const entryNumber = `JE-${hotel.code}-${yearPart}${String(monthPart).padStart(2, '0')}-${String(entrySequence++).padStart(4, '0')}`;
      const bd = new Date(businessDate);
      const postingDate = new Date(bd.getTime() + postingOffsetHours * 60 * 60 * 1000);

      await client.query(
        `INSERT INTO "JournalEntry" (
          id, "hotelId", "journalId", "entryNumber", "businessDate", "postingDate", "sourceType", "sourceId",
          reference, description, status, "fiscalPeriodId", "createdById", "reversedEntryId", "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5::date, $6, $7, $8, $9, $10, 'DRAFT', $11, $12, $13, now(), now()
        )`,
        [
          entryId,
          hotel.id,
          journalMap.get(journalCode),
          entryNumber,
          bd.toISOString().slice(0, 10),
          postingDate,
          sourceType,
          sourceId,
          reference ?? null,
          description,
          periodId,
          actorId,
          reversedEntryId,
        ],
      );

      for (const line of lines) {
        const accountId = accountMap.get(line.accountCode);
        if (!accountId) {
          throw new Error(`Unknown account code ${line.accountCode} in entry ${description}`);
        }
        const debit = Number(line.debit ?? 0);
        const credit = Number(line.credit ?? 0);
        if (debug) {
          console.error(`  [${description}] ${line.accountCode} ${debit} / ${credit}`);
        }
        if (Number.isNaN(debit) || Number.isNaN(credit) || (debit > 0) === (credit > 0)) {
          throw new Error(`Invalid line (${debit}/${credit}) in entry "${description}" -> ${line.accountCode} ${line.description ?? ''}`);
        }
        await client.query(
          `INSERT INTO "JournalLine" (id, "journalEntryId", "accountId", description, debit, credit, currency, "sourceType", "sourceId", "createdAt")
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, now())`,
          [entryId, accountId, line.description ?? null, debit.toFixed(4), credit.toFixed(4), currency, sourceType, sourceId],
        );

        const meta = accountMeta.get(line.accountCode);
        if (meta && (meta.type === 'REVENUE' || meta.type === 'EXPENSE') && sourceType !== 'YEAR_END_CLOSING') {
          if (!yearPnl.has(yearPart)) yearPnl.set(yearPart, new Map());
          const bucket = yearPnl.get(yearPart);
          const net = debit - credit;
          bucket.set(line.accountCode, (bucket.get(line.accountCode) ?? 0) + net);
        }
      }

      let sumDebit = 0;
      let sumCredit = 0;
      for (const line of lines) {
        sumDebit += Number(line.debit ?? 0);
        sumCredit += Number(line.credit ?? 0);
      }
      if (Math.abs(sumDebit - sumCredit) > 0.0004) {
        throw new Error(
          `Entry unbalanced before posting (debit ${sumDebit.toFixed(4)} / credit ${sumCredit.toFixed(4)}) in "${description}" [${sourceType}]`,
        );
      }

      await client.query(
        `UPDATE "JournalEntry"
         SET status = 'POSTED', "postedById" = $1, "postedAt" = $2, "updatedAt" = now()
         WHERE id = $3`,
        [actorId, postingDate, entryId],
      );
      return entryId;
    }

    async function postEntry(opts) {
      const sourceId = uniqueSource();
      await insertEntry({ ...opts, sourceId });
    }

    function dayOf(periodKey, d) {
      const [y, m] = periodKey.split('-').map(Number);
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      return new Date(Date.UTC(y, m - 1, Math.min(d, lastDay)));
    }

    // ---- Historical + current period posting ----
    let reversalPairs = 0;
    const debug = process.env.DEBUG_SEED === '1';

    const firstPeriodKey = `${startYear}-01`;

    // ---- Opening balance entry (brings the business onto the books) ----
    // Opening assets & liabilities are funded by the owner's initial capital.
    await postEntry({
      periodKey: firstPeriodKey,
      journalCode: 'GEN',
      businessDate: dayOf(firstPeriodKey, 1),
      sourceType: 'OPENING_BALANCE',
      description: `Opening balance to establish the books as of ${startYear}-01-01`,
      lines: [
        { accountCode: '1110', debit: 15000, description: 'Opening front desk cash' },
        { accountCode: '1120', debit: 45000, description: 'Opening bank balance' },
        { accountCode: '1130', debit: 5000, description: 'Opening mobile money balance' },
        { accountCode: '1310', debit: 6000, description: 'Opening food & beverage inventory' },
        { accountCode: '1320', debit: 2000, description: 'Opening amenities inventory' },
        { accountCode: '1410', debit: 60000, description: 'Opening furniture and fixtures' },
        { accountCode: '1420', debit: 20000, description: 'Opening kitchen equipment' },
        { accountCode: '1430', debit: 13000, description: 'Opening vehicles' },
        { accountCode: '2400', credit: 48000, description: 'Opening short-term loan' },
        { accountCode: '3100', credit: 118000, description: 'Owner initial capital' },
      ],
    });

    for (const [periodKey, periodId] of periodMap.entries()) {
      const yearPart = Number(periodKey.slice(0, 4));
      const monthPart = Number(periodKey.slice(5, 7));
      const monthIndex = monthPart - 1;
      const isCurrent = periodKey === currentPeriodKey;
      const growth = (yearPart - startYear) * 0.06 + monthIndex * 0.004;
      const seasonFactor = 1 + Math.sin((monthIndex / 12) * Math.PI * 2 - 1) * 0.15;
      const base = 8200 * (1 + growth) * seasonFactor;

      const roomRevenue = round2(base);
      const restaurantRevenue = round2(roomRevenue * randInt(32, 42) / 100);
      const laundryRevenue = round2(roomRevenue * randInt(5, 9) / 100);
      const transportRevenue = round2(roomRevenue * randInt(8, 14) / 100);
      const otherRevenue = round2(roomRevenue * randInt(2, 5) / 100);
      const totalRevenue = round2(roomRevenue + restaurantRevenue + laundryRevenue + transportRevenue + otherRevenue);
      const discountAmount = round2(totalRevenue * 0.02);
      const netRevenue = round2(totalRevenue - discountAmount);
      const fbCost = round2(restaurantRevenue * randInt(38, 46) / 100);
      const amenitiesCost = round2(roomRevenue * 0.01);
      const totalCostOfSales = round2(fbCost + amenitiesCost);

      // ---- 1. Night audit: room revenue recognition (receivable) ----
      await postEntry({
        periodKey, journalCode: 'NIGHT', businessDate: dayOf(periodKey, 1),
        sourceType: 'NIGHT_AUDIT', description: `Night audit room revenue for ${MONTH_NAMES[monthIndex]} ${yearPart}`,
        lines: [
          { accountCode: '1200', debit: roomRevenue, description: 'Guest folio room charges' },
          { accountCode: '4100', credit: roomRevenue, description: 'Room revenue' },
        ],
      });

      // ---- 2. Restaurant revenue with sales tax ----
      const restaurantTax = round2(restaurantRevenue * 0.05);
      const restaurantGross = round2(restaurantRevenue + restaurantTax);
      await postEntry({
        periodKey, journalCode: 'SALES', businessDate: dayOf(periodKey, 3),
        sourceType: 'SALES_RESTAURANT', description: `Restaurant sales for ${MONTH_NAMES[monthIndex]} ${yearPart}`,
        lines: [
          { accountCode: '1110', debit: restaurantGross, description: 'Cash restaurant receipts' },
          { accountCode: '4200', credit: restaurantRevenue, description: 'Restaurant revenue' },
          { accountCode: '2310', credit: restaurantTax, description: 'Sales tax collected' },
        ],
      });

      // ---- 3. Laundry + transport + other revenue (mixed cash) ----
      await postEntry({
        periodKey, journalCode: 'SALES', businessDate: dayOf(periodKey, 5),
        sourceType: 'SALES_OTHER', description: `Ancillary revenue for ${MONTH_NAMES[monthIndex]} ${yearPart}`,
        lines: [
          { accountCode: '1110', debit: round2(laundryRevenue + transportRevenue + otherRevenue), description: 'Cash receipts' },
          { accountCode: '4300', credit: laundryRevenue, description: 'Laundry revenue' },
          { accountCode: '4400', credit: transportRevenue, description: 'Transport revenue' },
          { accountCode: '4500', credit: otherRevenue, description: 'Other revenue' },
        ],
      });

      // ---- 4. Collect guest receivables (cash + bank + mobile split across journals) ----
      const cashCollected = round2(roomRevenue * randInt(38, 52) / 100);
      const bankCollected = round2(roomRevenue * randInt(20, 30) / 100);
      const mobileCollected = round2(roomRevenue - cashCollected - bankCollected);
      await postEntry({
        periodKey, journalCode: 'CASH', businessDate: dayOf(periodKey, 7),
        sourceType: 'RECEIVABLE_COLLECTION_CASH', description: `Cash receivable collections for ${MONTH_NAMES[monthIndex]} ${yearPart}`,
        lines: [
          { accountCode: '1110', debit: cashCollected, description: 'Cash collections' },
          { accountCode: '1200', credit: cashCollected, description: 'Guest receivable settlement' },
        ],
      });
      await postEntry({
        periodKey, journalCode: 'BANK', businessDate: dayOf(periodKey, 7),
        sourceType: 'RECEIVABLE_COLLECTION_BANK', description: `Bank receivable collections for ${MONTH_NAMES[monthIndex]} ${yearPart}`,
        lines: [
          { accountCode: '1120', debit: bankCollected, description: 'Bank collections' },
          { accountCode: '1200', credit: bankCollected, description: 'Guest receivable settlement' },
        ],
      });
      await postEntry({
        periodKey, journalCode: 'MOBILE', businessDate: dayOf(periodKey, 7),
        sourceType: 'RECEIVABLE_COLLECTION_MOBILE', description: `Mobile money collections for ${MONTH_NAMES[monthIndex]} ${yearPart}`,
        lines: [
          { accountCode: '1130', debit: mobileCollected, description: 'Mobile money collections' },
          { accountCode: '1200', credit: mobileCollected, description: 'Guest receivable settlement' },
        ],
      });

      // ---- 5. Guest deposits received ----
      const deposits = round2(roomRevenue * randInt(10, 16) / 100);
      await postEntry({
        periodKey, journalCode: 'CASH', businessDate: dayOf(periodKey, 9),
        sourceType: 'GUEST_DEPOSIT', description: `Guest deposits for ${MONTH_NAMES[monthIndex]} ${yearPart}`,
        lines: [
          { accountCode: '1110', debit: deposits, description: 'Cash deposit received' },
          { accountCode: '2200', credit: deposits, description: 'Guest deposit liability' },
        ],
      });

      // ---- 6. Cost of sales (inventory -> COGS) ----
      await postEntry({
        periodKey, journalCode: 'PURCHASE', businessDate: dayOf(periodKey, 11),
        sourceType: 'COST_OF_SALES', description: `Cost of sales for ${MONTH_NAMES[monthIndex]} ${yearPart}`,
        lines: [
          { accountCode: '5100', debit: fbCost, description: 'Food and beverage cost' },
          { accountCode: '5200', debit: amenitiesCost, description: 'Amenities cost' },
          { accountCode: '1310', credit: fbCost, description: 'F&B inventory usage' },
          { accountCode: '1320', credit: amenitiesCost, description: 'Amenities inventory usage' },
        ],
      });

      // ---- 7. Payroll (salaries) ----
      const salaries = round2(4300 * (1 + growth) + monthIndex * 120);
      const payrollTax = round2(salaries * 0.03);
      const netPay = round2(salaries - payrollTax);
      await postEntry({
        periodKey, journalCode: 'GEN', businessDate: dayOf(periodKey, 13),
        sourceType: 'PAYROLL', description: `Staff payroll for ${MONTH_NAMES[monthIndex]} ${yearPart}`,
        lines: [
          { accountCode: '6100', debit: salaries, description: 'Salaries and wages' },
          { accountCode: '2160', credit: netPay, description: 'Net salaries payable' },
          { accountCode: '2320', credit: payrollTax, description: 'Payroll tax withheld' },
        ],
      });

      // ---- 8. Pay salaries payable (cash + bank) ----
      const salariesPaid = round2(salaries * randInt(90, 100) / 100);
      await postEntry({
        periodKey, journalCode: 'BANK', businessDate: dayOf(periodKey, 15),
        sourceType: 'PAYROLL_PAYMENT', description: `Salary disbursement for ${MONTH_NAMES[monthIndex]} ${yearPart}`,
        lines: [
          { accountCode: '2160', debit: salariesPaid, description: 'Salaries paid' },
          { accountCode: '1120', credit: salariesPaid, description: 'Bank payment' },
        ],
      });

      // ---- 9. Utilities & operational expenses ----
      const electricity = round2(980 + monthIndex * 55 + randInt(-40, 40));
      const water = round2(320 + monthIndex * 20);
      const internet = round2(220 + (yearPart % 3) * 15);
      const cleaning = round2(700 + monthIndex * 45 + (monthIndex % 3) * 60);
      const maintenance = round2(randInt(150, 600));
      const marketing = round2(randInt(120, 420));
      const totalOps = round2(electricity + water + internet + cleaning + maintenance + marketing);
      await postEntry({
        periodKey, journalCode: 'PURCHASE', businessDate: dayOf(periodKey, 17),
        sourceType: 'OPERATING_EXPENSE', description: `Operating expenses for ${MONTH_NAMES[monthIndex]} ${yearPart}`,
        lines: [
          { accountCode: '6200', debit: electricity, description: 'Electricity' },
          { accountCode: '6300', debit: water, description: 'Water' },
          { accountCode: '6400', debit: internet, description: 'Internet and communication' },
          { accountCode: '6500', debit: cleaning, description: 'Cleaning supplies' },
          { accountCode: '6600', debit: maintenance, description: 'Maintenance and repairs' },
          { accountCode: '6800', debit: marketing, description: 'Marketing' },
          { accountCode: '1120', credit: totalOps, description: 'Bank payment' },
        ],
      });

      // ---- 10. Rent, insurance ----
      const rent = round2(1500 + (yearPart % 2) * 100);
      const insurance = round2(180);
      await postEntry({
        periodKey, journalCode: 'PURCHASE', businessDate: dayOf(periodKey, 19),
        sourceType: 'RENT_INSURANCE', description: `Rent and insurance for ${MONTH_NAMES[monthIndex]} ${yearPart}`,
        lines: [
          { accountCode: '6700', debit: rent, description: 'Rent' },
          { accountCode: '6750', debit: insurance, description: 'Insurance' },
          { accountCode: '1120', credit: round2(rent + insurance), description: 'Bank payment' },
        ],
      });

      // ---- 11. Depreciation ----
      const depreciation = round2(420 + monthIndex * 5);
      await postEntry({
        periodKey, journalCode: 'ADJUST', businessDate: dayOf(periodKey, 20),
        sourceType: 'DEPRECIATION', description: `Monthly depreciation for ${MONTH_NAMES[monthIndex]} ${yearPart}`,
        lines: [
          { accountCode: '6850', debit: depreciation, description: 'Depreciation expense' },
          { accountCode: '1510', credit: depreciation, description: 'Accumulated depreciation - furniture' },
        ],
      });

      // ---- 12. Loan repayment (principal + interest) ----
      const loanPayment = round2(650);
      const interest = round2(loanPayment * randInt(25, 35) / 100);
      const principal = round2(loanPayment - interest);
      await postEntry({
        periodKey, journalCode: 'BANK', businessDate: dayOf(periodKey, 22),
        sourceType: 'LOAN_PAYMENT', description: `Loan repayment for ${MONTH_NAMES[monthIndex]} ${yearPart}`,
        lines: [
          { accountCode: '2400', debit: principal, description: 'Loan principal' },
          { accountCode: '6900', debit: interest, description: 'Loan interest' },
          { accountCode: '1120', credit: loanPayment, description: 'Bank payment' },
        ],
      });

      // ---- 13. Fixed asset purchase ----
      if (monthPart % 6 === 2) {
        const assetPurchase = round2(randInt(1200, 3600));
        await postEntry({
          periodKey, journalCode: 'BANK', businessDate: dayOf(periodKey, 24),
          sourceType: 'ASSET_PURCHASE', description: `Equipment purchase for ${MONTH_NAMES[monthIndex]} ${yearPart}`,
          lines: [
            { accountCode: '1420', debit: assetPurchase, description: 'Kitchen equipment' },
            { accountCode: '1120', credit: assetPurchase, description: 'Bank payment' },
          ],
        });
      }

      // ---- 14. Pay suppliers (accounts payable) ----
      const supplierPayment = round2(fbCost * randInt(70, 90) / 100);
      await postEntry({
        periodKey, journalCode: 'BANK', businessDate: dayOf(periodKey, 26),
        sourceType: 'SUPPLIER_PAYMENT', description: `Supplier payments for ${MONTH_NAMES[monthIndex]} ${yearPart}`,
        lines: [
          { accountCode: '2100', debit: supplierPayment, description: 'Accounts payable settlement' },
          { accountCode: '1120', credit: supplierPayment, description: 'Bank payment' },
        ],
      });

      // ---- 15. Purchases on credit (F&B inventory) ----
      const creditPurchase = round2(fbCost * randInt(8, 15) / 100);
      await postEntry({
        periodKey, journalCode: 'PURCHASE', businessDate: dayOf(periodKey, 27),
        sourceType: 'CREDIT_PURCHASE', description: `Credit purchases for ${MONTH_NAMES[monthIndex]} ${yearPart}`,
        lines: [
          { accountCode: '1310', debit: creditPurchase, description: 'F&B inventory' },
          { accountCode: '2100', credit: creditPurchase, description: 'Accounts payable' },
        ],
      });

      // ---- 16. Bank charges & mobile money fees ----
      const fees = round2(mobileCollected * 0.01 + bankCollected * 0.004);
      const bankFeeShare = round2(fees * 0.5);
      const mobileFeeShare = round2(fees - bankFeeShare);
      await postEntry({
        periodKey, journalCode: 'BANK', businessDate: dayOf(periodKey, 28),
        sourceType: 'BANK_FEES', description: `Processing fees for ${MONTH_NAMES[monthIndex]} ${yearPart}`,
        lines: [
          { accountCode: '6950', debit: fees, description: 'Bank and mobile money fees' },
          { accountCode: '1120', credit: bankFeeShare, description: 'Bank fees' },
          { accountCode: '1130', credit: mobileFeeShare, description: 'Mobile money fees' },
        ],
      });

      // ---- 17. Corporate receivable (unpaid at month end) ----
      const corporateDebt = round2(roomRevenue * randInt(6, 10) / 100);
      await postEntry({
        periodKey, journalCode: 'SALES', businessDate: dayOf(periodKey, 29),
        sourceType: 'CORPORATE_SALES', description: `Corporate account sales for ${MONTH_NAMES[monthIndex]} ${yearPart}`,
        lines: [
          { accountCode: '1210', debit: corporateDebt, description: 'Corporate receivable' },
          { accountCode: '4100', credit: corporateDebt, description: 'Room revenue on account' },
        ],
      });

      // ---- 18. Discount on revenue (contra) ----
      await postEntry({
        periodKey, journalCode: 'SALES', businessDate: dayOf(periodKey, 30),
        sourceType: 'SALES_DISCOUNT', description: `Sales discounts for ${MONTH_NAMES[monthIndex]} ${yearPart}`,
        lines: [
          { accountCode: '4090', debit: discountAmount, description: 'Sales discounts granted' },
          { accountCode: '1200', credit: discountAmount, description: 'Guest receivable reduction' },
        ],
      });

      // For a few months, also post an adjustment + reversal to exercise job reversibility.
      if (monthPart === 3 || monthPart === 6) {
        const erroneous = round2(randInt(80, 160));
        // Post an erroneous entry.
        const errEntryId = await insertEntry({
          periodKey, journalCode: 'ADJUST', businessDate: dayOf(periodKey, 28),
          sourceType: 'ERRONEOUS_POSTING', description: `Erroneous adjustment for ${MONTH_NAMES[monthIndex]} ${yearPart}`,
          lines: [
            { accountCode: '6900', debit: erroneous, description: 'Misc expense (to be reversed)' },
            { accountCode: '1110', credit: erroneous, description: 'Cash (to be reversed)' },
          ],
        });
        // Create the reversal entry, linking back to the original, then post it.
        await insertEntry({
          periodKey, journalCode: 'ADJUST', businessDate: dayOf(periodKey, 28),
          sourceType: 'REVERSAL', sourceId: null, description: `Reversal of erroneous adjustment for ${MONTH_NAMES[monthIndex]} ${yearPart}`,
          reversedEntryId: errEntryId,
          lines: [
            { accountCode: '6900', credit: erroneous, description: 'Reversal of misc expense' },
            { accountCode: '1110', debit: erroneous, description: 'Reversal of cash' },
          ],
        });
        // Mark the original as reversed; it may transition POSTED -> REVERSED.
        const revResult = await client.query(
          `SELECT id FROM "JournalEntry" WHERE "hotelId" = $1 AND "sourceType" = 'REVERSAL' AND "reversedEntryId" = $2 ORDER BY "createdAt" DESC LIMIT 1`,
          [hotel.id, errEntryId],
        );
        const reverseEntryId = revResult.rows[0].id;
        await client.query(
          `UPDATE "JournalEntry" SET status='REVERSED',"reversalEntryId"=$1,"reversalReason"='Seeded demonstration reversal',"reversedById"=$2,"reversedAt"=now(),"updatedAt"=now() WHERE id=$3`,
          [reverseEntryId, actorId, errEntryId],
        );
        reversalPairs += 1;
      }
    }

    // ---- Year-end closing entries for completed fiscal years ----
    // Close each fully-completed year's income statement into Retained Earnings (3200),
    // posted into the first (still OPEN) period of the following year.
    for (let year = startYear; year < currentYear; year += 1) {
      const bucket = yearPnl.get(year);
      if (!bucket || bucket.size === 0) continue;
      const closeKey = `${year + 1}-01`;
      const lines = [];
      let totalDebitCents = 0;
      let totalCreditCents = 0;
      const toCents = (v) => Math.round(v * 100);
      for (const [accountCode, netBalance] of bucket) {
        const meta = accountMeta.get(accountCode) ?? { normalBalance: 'DEBIT' };
        const normal = meta.normalBalance ?? 'DEBIT';
        if (normal === 'CREDIT') {
          const amount = round2(-netBalance); // revenue accounts carry a credit (negative net) -> debit to close
          lines.push({ accountCode, debit: amount, description: `Close ${year} income` });
          totalDebitCents += toCents(amount);
        } else {
          const amount = round2(netBalance);
          lines.push({ accountCode, credit: amount, description: `Close ${year} expense` });
          totalCreditCents += toCents(amount);
        }
      }
      const retainedCents = totalDebitCents - totalCreditCents;
      const retainedEarnings = retainedCents / 100;
      if (retainedEarnings >= 0) {
        lines.push({ accountCode: '3200', credit: round2(retainedEarnings), description: `Retained earnings for ${year}` });
        totalCreditCents += retainedCents;
      } else {
        lines.push({ accountCode: '3200', debit: round2(-retainedEarnings), description: `Prior year loss for ${year}` });
        totalDebitCents += -retainedCents;
      }
      await postEntry({
        periodKey: closeKey,
        journalCode: 'GEN',
        businessDate: dayOf(closeKey, 1),
        sourceType: 'YEAR_END_CLOSING',
        reference: `FY${year}-CLOSE`,
        description: `Year-end closing for fiscal year ${year}${year === currentYear - 1 ? ` (${year}-12-31)` : ''}`,
        lines,
      });
    }

    await client.query(
      `UPDATE "FiscalPeriod"
       SET status = 'CLOSED', "updatedAt" = now()
       WHERE "hotelId" = $1 AND name <> $2 AND status = 'OPEN'`,
      [hotel.id, currentPeriodKey],
    );

    const counts = await client.query(
      `SELECT
         (SELECT COUNT(*) FROM "Account" WHERE "hotelId" = $1) AS account_count,
         (SELECT COUNT(*) FROM "FiscalPeriod" WHERE "hotelId" = $1) AS fiscal_period_count,
         (SELECT COUNT(*) FROM "JournalEntry" WHERE "hotelId" = $1) AS journal_entry_count,
         (SELECT COUNT(*) FROM "JournalEntry" WHERE "hotelId" = $1 AND status='REVERSED') AS reversed_count,
         (SELECT COUNT(*) FROM "JournalLine" jl JOIN "JournalEntry" je ON je.id = jl."journalEntryId" WHERE je."hotelId" = $1) AS journal_line_count,
         (SELECT COUNT(*) FROM "JournalEntry" WHERE "hotelId" = $1 AND status='POSTED') AS posted_count`,
      [hotel.id],
    );

    await client.query('COMMIT');

    console.log(`Full accounting seed complete for hotel ${hotel.code}.`);
    console.log(JSON.stringify({
      hotel: hotel.code,
      accountCount: Number(counts.rows[0].account_count),
      fiscalPeriodCount: Number(counts.rows[0].fiscal_period_count),
      journalEntryCount: Number(counts.rows[0].journal_entry_count),
      journalLineCount: Number(counts.rows[0].journal_line_count),
      postedCount: Number(counts.rows[0].posted_count),
      reversedCount: Number(counts.rows[0].reversed_count),
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
  console.error('Full accounting seed failed.');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
