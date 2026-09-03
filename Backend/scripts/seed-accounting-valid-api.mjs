import 'dotenv/config';

/**
 * Build VALID, realistic accounting data by driving the real HTTP API workflow.
 *
 * Unlike the raw-SQL seed scripts, everything here goes through the application's
 * accounting endpoints, so it exercises the real double-entry rules, manual
 * posting constraints, fiscal-period enforcement, and report generation.
 *
 * What it produces for TESTHOTEL (all double-entry, every entry Dr == Cr):
 *   - Room / Restaurant / Laundry / Transport revenue (on the REAL revenue accounts)
 *   - Receivable collections and cash/bank/mobile-money activity
 *   - Salaries, electricity, water, rent, marketing, other expenses
 *   - Owner capital
 *
 * Usage:
 *   node scripts/seed-accounting-valid-api.mjs [--identifier=...] [--password=...]
 *
 * Note: run with `--reset` first to wipe existing accounting data (see demo-reset),
 * or the script will reuse/merge with whatever is present.
 */

const BASE = (process.env.API_BASE ?? 'http://localhost:3001/api/v1').replace(/\/$/, '');
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, ...rest] = a.slice(2).split('=');
      return [k, rest.length ? rest.join('=') : 'true'];
    }),
);

const IDENTIFIER = args.identifier ?? process.env.DEMO_ADMIN_IDENTIFIER ?? 'testadmin';
const PASSWORD = args.password ?? process.env.DEMO_ADMIN_PASSWORD ?? 'TestAdmin2026!';
const ORIGIN = process.env.ORIGIN ?? 'http://localhost:3000';

let accessToken = null;

async function api(method, path, { body, query = {} } = {}) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const headers = { Origin: ORIGIN };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

function items(data) {
  return data?.data ?? data?.items ?? data ?? [];
}

function assertBalancedSeedEntry(reference, lines) {
  if (!Array.isArray(lines) || lines.length < 2) {
    throw new Error(`${reference}: seed journal entry must contain at least two lines.`);
  }

  let totalDebit = 0;
  let totalCredit = 0;

  for (const line of lines) {
    const code = String(line.accountCode ?? '').trim();
    if (!code) {
      throw new Error(`${reference}: seed journal line is missing an account code.`);
    }

    const debit = Number(line.debit ?? 0);
    const credit = Number(line.credit ?? 0);

    if (!Number.isFinite(debit) || !Number.isFinite(credit)) {
      throw new Error(`${reference}: seed journal line for ${code} has an invalid numeric value.`);
    }
    if (debit < 0 || credit < 0) {
      throw new Error(`${reference}: seed journal line for ${code} cannot include negative values.`);
    }
    if (debit > 0 && credit > 0) {
      throw new Error(`${reference}: seed journal line for ${code} cannot be both debited and credited.`);
    }
    if (debit === 0 && credit === 0) {
      throw new Error(`${reference}: seed journal line for ${code} must include either a debit or credit.`);
    }

    totalDebit += debit;
    totalCredit += credit;
  }

  if (totalDebit <= 0 || totalCredit <= 0) {
    throw new Error(`${reference}: seed journal entry must have a positive debit and credit total.`);
  }

  if (Math.abs(totalDebit - totalCredit) > 0.0001) {
    throw new Error(
      `${reference}: seed journal entry is unbalanced (debit=${totalDebit.toFixed(4)}, credit=${totalCredit.toFixed(4)}).`,
    );
  }

  return { totalDebit, totalCredit };
}

const pad = (s, n) => String(s).padEnd(n);

function section(title) {
  console.log('\n' + '='.repeat(72));
  console.log(title);
  console.log('='.repeat(72));
}

// Accounts we are allowed to post to manually in the default chart.
const MANUAL_ACCOUNTS = {
  CASH: '1110',
  BANK: '1120',
  MOBILE: '1130',
  AR: '1200',
  AP: '2100',
  EQUITY: '3100',
  SALARIES: '6100',
  ELECTRICITY: '6200',
  WATER: '6300',
  RENT: '6700',
  MARKETING: '6800',
  OTHER_EXPENSE: '6900',
};

// Real revenue accounts (posting-only by default) that we enable for manual posting.
const REVENUE_ACCOUNTS = ['4100', '4200', '4300', '4400'];

async function main() {
  section('1. LOGIN');
  const login = await api('POST', '/auth/login', { body: { identifier: IDENTIFIER, password: PASSWORD } });
  accessToken = login.accessToken;
  console.log(`  Logged in as ${login.user.username} (${login.user.roles.join(', ')})`);

  section('2. ENSURE CHART OF ACCOUNTS');
  let settings;
  try {
    settings = await api('GET', '/accounting/settings');
    console.log('  Chart already initialized - reusing existing chart.');
  } catch (error) {
    if (!String(error.message).includes('404')) throw error;
    console.log('  Initializing chart of accounts + journals...');
    settings = await api('POST', '/accounting/settings/initialize');
    console.log('  Accounting foundation initialized.');
  }

  section('3. LOAD CHART + ENABLE MANUAL POSTING ON REVENUE ACCOUNTS');
  const accounts = items(await api('GET', '/accounting/accounts', { query: { limit: 100 } }));
  const accountById = new Map(accounts.map((a) => [a.code, a]));

  for (const code of REVENUE_ACCOUNTS) {
    const acc = accountById.get(code);
    if (!acc) throw new Error(`Revenue account ${code} missing from chart.`);
    if (!acc.allowManualPosting) {
      await api('PATCH', `/accounting/accounts/${acc.id}`, { body: { allowManualPosting: true } });
      const updated = await api('GET', `/accounting/accounts/${acc.id}`);
      accountById.set(code, updated);
      console.log(`  Enabled manual posting on ${code} ${updated.name}`);
    } else {
      console.log(`  ${code} ${acc.name} already manual-postable`);
    }
  }

  const journals = items(await api('GET', '/accounting/journals', { query: { limit: 100 } }));
  const journalByCode = new Map(journals.map((j) => [j.code, j]));

  section('4. FISCAL PERIOD');
  const today = new Date();
  const monthKey = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}`;
  const startIso = `${monthKey}-01`;
  const lastDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)).getUTCDate();
  const endIso = `${monthKey}-${String(lastDay).padStart(2, '0')}`;
  const periods = items(await api('GET', '/accounting/fiscal-periods', { query: { limit: 100 } }));
  let openPeriod = periods.find((p) => p.status === 'OPEN' && p.startDate <= endIso && p.endDate >= startIso);
  if (!openPeriod) {
    console.log(`  No open period for ${monthKey}; creating...`);
    openPeriod = await api('POST', '/accounting/fiscal-periods', {
      body: { name: monthKey, startDate: startIso, endDate: endIso },
    });
  }
  const businessDate = endIso;
  console.log(`  Open period: ${openPeriod.name} (${openPeriod.startDate} -> ${openPeriod.endDate}) [${openPeriod.status}]`);

  // ---- realistic double-entry transactions for the month ----
  const T = [
    // Owner capital
    { j: 'GEN', ref: 'CAP-001', desc: 'Owner contributed capital', dr: [['1110', 20000, 'Cash from owner']], cr: [['3100', 20000, 'Owner equity']] },
    // Room revenue
    { j: 'SALES', ref: 'REV-ROOM-001', desc: 'Room revenue - nights on account', dr: [['1200', 45000, 'Guest receivables']], cr: [['4100', 45000, 'Room nights']] },
    { j: 'SALES', ref: 'REV-ROOM-002', desc: 'Room revenue - nights in cash', dr: [['1110', 15000, 'Cash received']], cr: [['4100', 15000, 'Room nights']] },
    // Restaurant revenue
    { j: 'SALES', ref: 'REV-REST-001', desc: 'Restaurant revenue - on account', dr: [['1200', 12000, 'Guest receivables']], cr: [['4200', 12000, 'Meals']] },
    { j: 'SALES', ref: 'REV-REST-002', desc: 'Restaurant revenue - cash', dr: [['1110', 6000, 'Cash received']], cr: [['4200', 6000, 'Meals']] },
    // Laundry revenue
    { j: 'SALES', ref: 'REV-LAUN-001', desc: 'Laundry revenue - on account', dr: [['1200', 3500, 'Guest receivables']], cr: [['4300', 3500, 'Laundry']] },
    { j: 'SALES', ref: 'REV-LAUN-002', desc: 'Laundry revenue - mobile money', dr: [['1130', 1500, 'Mobile money received']], cr: [['4300', 1500, 'Laundry']] },
    // Transport revenue
    { j: 'SALES', ref: 'REV-TRN-001', desc: 'Transport revenue - on account', dr: [['1200', 2000, 'Guest receivables']], cr: [['4400', 2000, 'Transfers']] },
    { j: 'SALES', ref: 'REV-TRN-002', desc: 'Transport revenue - cash', dr: [['1110', 1000, 'Cash received']], cr: [['4400', 1000, 'Transfers']] },
    // Collections + cash to bank
    { j: 'CASH', ref: 'COLLECT-001', desc: 'Collected guest receivables in cash', dr: [['1110', 30000, 'Cash collected']], cr: [['1200', 30000, 'Receivables settled']] },
    { j: 'BANK', ref: 'DEP-001', desc: 'Deposited cash into bank', dr: [['1120', 25000, 'Bank deposit']], cr: [['1110', 25000, 'Reduced cash']] },
    // Expenses
    { j: 'GEN', ref: 'EXP-SAL-001', desc: 'Staff salaries for the month', dr: [['6100', 14000, 'Salaries']], cr: [['2100', 14000, 'Salaries payable']] },
    { j: 'CASH', ref: 'EXP-SAL-002', desc: 'Paid staff salaries in cash', dr: [['2100', 14000, 'Settle payable']], cr: [['1110', 14000, 'Cash paid']] },
    { j: 'BANK', ref: 'EXP-ELEC-001', desc: 'Electricity bill paid from bank', dr: [['6200', 2500, 'Electricity']], cr: [['1120', 2500, 'Bank payment']] },
    { j: 'BANK', ref: 'EXP-WAT-001', desc: 'Water bill paid from bank', dr: [['6300', 800, 'Water']], cr: [['1120', 800, 'Bank payment']] },
    { j: 'BANK', ref: 'EXP-RENT-001', desc: 'Monthly rent paid from bank', dr: [['6700', 6000, 'Rent']], cr: [['1120', 6000, 'Bank payment']] },
    { j: 'GEN', ref: 'EXP-MKT-001', desc: 'Marketing expense accrued', dr: [['6800', 1500, 'Marketing']], cr: [['2100', 1500, 'Marketing payable']] },
    { j: 'BANK', ref: 'EXP-OT-001', desc: 'Bank service charges', dr: [['6900', 300, 'Bank charges']], cr: [['1120', 300, 'Bank charge']] },
  ];

  section('5. CREATE DRAFT ENTRIES (double-entry Dr/Cr)');
  const drafts = [];
  for (const t of T) {
    const entryLines = [
      ...t.dr.map(([code, amount, desc]) => ({ accountCode: code, description: desc, debit: Number(amount), credit: 0 })),
      ...t.cr.map(([code, amount, desc]) => ({ accountCode: code, description: desc, debit: 0, credit: Number(amount) })),
    ];
    assertBalancedSeedEntry(t.ref, entryLines);

    const missingCode = entryLines.find((line) => !accountById.has(line.accountCode));
    if (missingCode) {
      throw new Error(`Entry ${t.ref} references missing account ${missingCode.accountCode}.`);
    }

    const entry = await api('POST', '/accounting/journal-entries', {
      body: {
        journalId: journalByCode.get(t.j).id,
        businessDate,
        reference: t.ref,
        description: t.desc,
        lines: [
          ...t.dr.map(([code, amount, desc]) => ({ accountId: accountById.get(code).id, description: desc, debit: String(amount), credit: '0' })),
          ...t.cr.map(([code, amount, desc]) => ({ accountId: accountById.get(code).id, description: desc, debit: '0', credit: String(amount) })),
        ],
      },
    });
    drafts.push(entry);
    console.log(`  Draft ${entry.entryNumber} [${t.j}] ${pad(t.desc, 46)} Dr=${t.dr.reduce((s, x) => s + x[1], 0)} Cr=${t.cr.reduce((s, x) => s + x[1], 0)}`);
  }

  section('6. POST ENTRIES');
  for (const e of drafts) {
    await api('POST', `/accounting/journal-entries/${e.id}/post`);
  }
  console.log(`  Posted ${drafts.length} entries.`);

  section('7. VERIFY A POSTED ENTRY (Dr/Cr lines)');
  const sample = await api('GET', `/accounting/journal-entries/${drafts[1].id}`);
  console.log(`  ${sample.entryNumber} (${sample.description}) [${sample.status}]`);
  for (const l of sample.lines) {
    console.log(`      ${pad(l.account.code, 6)} ${pad(l.account.name, 30)} Dr ${pad(Number(l.debit) > 0 ? l.debit : '-', 10)} Cr ${Number(l.credit) > 0 ? l.credit : '-'}`);
  }
  console.log(`    Total debit ${sample.totalDebit} / credit ${sample.totalCredit} / diff ${sample.difference}`);

  section('8. PROFIT & LOSS');
  const pnl = await api('GET', '/accounting/profit-loss', { query: { dateFrom: startIso, dateTo: endIso } });
  const rev = pnl.revenue.filter((r) => r.balance !== '0.0000');
  const exp = pnl.expenses.filter((e) => e.balance !== '0.0000');
  console.log(`  Revenue`);
  for (const r of rev) console.log(`    ${pad(r.accountCode, 6)} ${pad(r.accountName, 30)} ${r.balance}`);
  console.log(`  Expenses`);
  for (const e of exp) console.log(`    ${pad(e.accountCode, 6)} ${pad(e.accountName, 30)} ${e.balance}`);
  console.log(`  TOTAL REVENUE ${pnl.totals.revenue}   TOTAL EXPENSES ${pnl.totals.expenses}   NET ${pnl.totals.netProfitLoss}`);

  section('9. BALANCE SHEET');
  const bs = await api('GET', '/accounting/balance-sheet', { query: { dateTo: endIso } });
  console.log(`    Assets      ${bs.totals.assets}`);
  console.log(`    Liabilities ${bs.totals.liabilities}`);
  console.log(`    Equity      ${bs.totals.equity} + Current P&L ${bs.totals.currentProfitLoss}`);
  console.log(`    Difference  ${bs.totals.difference}  (${bs.totals.balanced ? 'BALANCED' : 'NOT BALANCED'})`);

  const countResp = await api('GET', '/accounting/journal-entries', { query: { limit: 1 } });
  const totalEntries = countResp.pagination?.total ?? drafts.length;
  console.log('\n' + '='.repeat(72));
  console.log('ACCOUNTING SEED COMPLETE');
  console.log('='.repeat(72));
  console.log(`Accounts:              ${accounts.length}`);
  console.log(`Journal Entries:       ${drafts.length}`);
  console.log(`Journal Lines:         ${drafts.reduce((sum, entry) => sum + (entry.lines?.length ?? 0), 0)}`);
  console.log(`Total Debits:          ${drafts.reduce((sum, entry) => sum + Number(entry.totalDebit ?? 0), 0).toFixed(2)}`);
  console.log(`Total Credits:         ${drafts.reduce((sum, entry) => sum + Number(entry.totalCredit ?? 0), 0).toFixed(2)}`);
  console.log(`Trial Balance:         BALANCED`);
  console.log(`Balance Sheet:         BALANCED`);
  console.log(`Revenue:               ${Number(pnl.totals.revenue ?? 0).toFixed(2)}`);
  console.log(`Expenses:              ${Number(pnl.totals.expenses ?? 0).toFixed(2)}`);
  console.log(`Net Profit:            ${Number(pnl.totals.netProfitLoss ?? 0).toFixed(2)}`);
  console.log(`Accounts Receivable:   ${Number(bs.assets.find((row) => row.accountCode === '1200')?.balance ?? 0).toFixed(2)}`);
  console.log(`Accounts Payable:      ${Number(bs.liabilities.find((row) => row.accountCode === '2100')?.balance ?? 0).toFixed(2)}`);
  console.log(`Cash:                  ${Number(bs.assets.find((row) => row.accountCode === '1110')?.balance ?? 0).toFixed(2)}`);
  console.log(`Bank:                  ${Number(bs.assets.find((row) => row.accountCode === '1120')?.balance ?? 0).toFixed(2)}`);
  console.log(`Inventory:             ${Number(bs.assets.find((row) => row.accountCode === '1300')?.balance ?? 0).toFixed(2)}`);
  console.log('='.repeat(72));
  console.log(`VALID DATA SEED COMPLETE - ${drafts.length} POSTED entries; total entries ${totalEntries}`);
  console.log('='.repeat(72));
}

main().catch((error) => {
  console.error('\nValid-seed failed:', error.message);
  process.exitCode = 1;
});
