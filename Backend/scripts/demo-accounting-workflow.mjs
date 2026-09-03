import 'dotenv/config';

/**
 * Demo: drive the real accounting workflow over the HTTP API.
 *
 * Shows that every accounting transaction is a DOUBLE-ENTRY with explicit
 * Debit (Dr) and Credit (Cr) lines, and that Profit & Loss is computed from
 * those Dr/Cr lines.
 *
 * Flow:
 *   1. Login (admin)                     POST /auth/login
 *   2. Initialize the chart of accounts  POST /accounting/settings/initialize
 *   3. Fetch chart + journals            GET  /accounting/accounts, /accounting/journals
 *   4. Ensure an OPEN fiscal period      GET  /accounting/fiscal-periods (+ POST if missing)
 *   5. Create draft manual entries        POST /accounting/journal-entries   (Dr/Cr lines)
 *   6. Post drafts                        POST /accounting/journal-entries/:id/post
 *   7. Show Cr/Dr on created entries      GET  /accounting/journal-entries/:id
 *   8. Reverse one posted entry           POST /accounting/journal-entries/:id/reverse
 *   9. Profit & Loss report               GET  /accounting/profit-loss
 *  10. Balance Sheet report               GET  /accounting/balance-sheet
 *
 * Usage:
 *   node scripts/demo-accounting-workflow.mjs [--identifier=ADMIN_USERNAME] [--password=...]
 *
 * Defaults to the seeded ADMIN user `testadmin` for hotel TESTHOTEL.
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

async function api(method, path, { body, query = {}, raw = false } = {}) {
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
    data = raw ? text : { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

// ---- helpers to extract items from paginated responses ----
function items(data) {
  return data?.data ?? data?.items ?? data ?? [];
}

const pad = (s, n) => String(s).padEnd(n);

function section(title) {
  console.log('\n' + '='.repeat(72));
  console.log(title);
  console.log('='.repeat(72));
}

async function main() {
  // 1. Login
  section('1. LOGIN');
  const login = await api('POST', '/auth/login', {
    body: { identifier: IDENTIFIER, password: PASSWORD },
  });
  accessToken = login.accessToken;
  console.log(`  Logged in as ${login.user.username} (${login.user.roles.join(', ')})`);
  console.log(`  Permissions include journal.post: ${login.user.permissions.includes('journal.post')}`);

  // 2. Ensure the chart of accounts exists (initialize only if absent)
  section('2. ENSURE CHART OF ACCOUNTS');
  let settings;
  try {
    settings = await api('GET', '/accounting/settings');
    console.log('  Accounting already initialized - reusing existing chart.');
  } catch (error) {
    if (!String(error.message).includes('404')) throw error;
    console.log('  Not initialized; posting initialize (creates chart of accounts + journals)...');
    settings = await api('POST', '/accounting/settings/initialize');
    console.log('  Accounting foundation initialized.');
  }

  // 3. Fetch accounts + journals so we can build Dr/Cr lines by account code
  section('3. FETCH CHART OF ACCOUNTS & JOURNALS');
  const accounts = items(await api('GET', '/accounting/accounts', { query: { limit: 100 } }));
  const journals = items(await api('GET', '/accounting/journals', { query: { limit: 100 } }));
  const accountById = new Map(accounts.map((a) => [a.code, a]));
  const journalByCode = new Map(journals.map((j) => [j.code, j]));

  const need = ['1110', '1200', '1120', '2100', '3100', '6100', '6200', '6900'];
  for (const code of need) {
    if (!accountById.has(code)) {
      throw new Error(`Account ${code} not found after initialize.`);
    }
  }
  for (const code of ['GEN', 'SALES', 'CASH', 'BANK']) {
    if (!journalByCode.has(code)) {
      throw new Error(`Journal ${code} not found after initialize.`);
    }
  }

  // Manual journal lines may only hit accounts with allowManualPosting=true.
  // The default revenue accounts are posting-only, so create a manual revenue
  // account to demonstrate the full Profit & Loss (revenue + expenses) flow.
  let revenueAccount = accountById.get('4600');
  if (!revenueAccount) {
    section('3.1. CREATE MANUAL REVENUE ACCOUNT');
    revenueAccount = await api('POST', '/accounting/accounts', {
      body: {
        code: '4600',
        name: 'Demo Other Revenue',
        type: 'REVENUE',
        normalBalance: 'CREDIT',
        allowManualPosting: true,
      },
    });
    accountById.set(revenueAccount.code, revenueAccount);
    console.log(`  Created manual revenue account ${revenueAccount.code} ${revenueAccount.name}`);
  }

  console.log(`  Accounts available: ${accountById.size}, Journals loaded: ${journals.length}`);
  for (const code of ['1110', '1200', '4600', '2100', '6100', '6200']) {
    const a = accountById.get(code);
    if (a) console.log(`    ${pad(code, 6)} ${pad(a.type, 8)} ${pad(a.normalBalance, 7)} ${a.name}`);
  }

  // 4. Ensure an OPEN fiscal period covers today
  section('4. FISCAL PERIOD');
  const today = new Date();
  const monthKey = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}`;
  const startIso = `${monthKey}-01`;
  const lastDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)).getUTCDate();
  const endIso = `${monthKey}-${String(lastDay).padStart(2, '0')}`;

  const periods = items(await api('GET', '/accounting/fiscal-periods', { query: { limit: 100 } }));
  let openPeriod = periods.find(
    (p) => p.status === 'OPEN' && p.startDate <= endIso && p.endDate >= startIso,
  );
  if (!openPeriod) {
    console.log(`  No open period for ${monthKey}; creating one...`);
    openPeriod = await api('POST', '/accounting/fiscal-periods', {
      body: { name: monthKey, startDate: startIso, endDate: endIso },
    });
  }
  console.log(`  Open period: ${openPeriod.name} (${openPeriod.startDate} -> ${openPeriod.endDate}) [${openPeriod.status}]`);

  const businessDate = endIso;

  // 5. Create draft entries (explicit Dr/Cr lines)
  section('5. CREATE DRAFT ENTRIES (Dr/Cr lines)');

  async function createDraft({ journalCode, description, reference, dr, cr }) {
    const entry = await api('POST', '/accounting/journal-entries', {
      body: {
        journalId: journalByCode.get(journalCode).id,
        businessDate,
        reference,
        description,
        lines: [
          ...dr.map((l) => ({ accountId: accountById.get(l.accountCode).id, description: l.description, debit: String(l.amount), credit: '0' })),
          ...cr.map((l) => ({ accountId: accountById.get(l.accountCode).id, description: l.description, debit: '0', credit: String(l.amount) })),
        ],
      },
    });
    console.log(`  Created draft ${entry.entryNumber} [${journalCode}] - ${entry.description}`);
    console.log(`     Dr: ${dr.map((l) => `${l.accountCode} ${l.amount}`).join(', ')}`);
    console.log(`     Cr: ${cr.map((l) => `${l.accountCode} ${l.amount}`).join(', ')}`);
    return entry;
  }

  // Entry A: recognize revenue (Dr Guest AR / Cr Demo Revenue) - shows up in P&L revenue
  const entryA = await createDraft({
    journalCode: 'SALES',
    reference: 'DEMO-REV-001',
    description: 'Demo revenue recognized (guest charged on account)',
    dr: [{ accountCode: '1200', amount: 500.0, description: 'Guest receivable' }],
    cr: [{ accountCode: '4600', amount: 500.0, description: 'Revenue earned' }],
  });

  // Entry B: collect that receivable in cash (Dr Cash / Cr Guest AR)
  const entryB = await createDraft({
    journalCode: 'CASH',
    reference: 'DEMO-COLLECT-001',
    description: 'Guest receivable collected in cash',
    dr: [{ accountCode: '1110', amount: 500.0, description: 'Cash received' }],
    cr: [{ accountCode: '1200', amount: 500.0, description: 'Guest receivable settled' }],
  });

  // Entry C: pay electricity by bank (Dr Electricity / Cr Bank) - expense in P&L
  const entryC = await createDraft({
    journalCode: 'BANK',
    reference: 'DEMO-ELEC-001',
    description: 'Electricity bill paid from bank',
    dr: [{ accountCode: '6200', amount: 120.0, description: 'Electricity expense' }],
    cr: [{ accountCode: '1120', amount: 120.0, description: 'Bank payment' }],
  });

  // Entry D: salaries incurred but not yet paid (Dr Salaries / Cr Accounts Payable)
  const entryD = await createDraft({
    journalCode: 'GEN',
    reference: 'DEMO-PAYROLL-001',
    description: 'Staff salaries accrued for the month',
    dr: [{ accountCode: '6100', amount: 300.0, description: 'Salaries expense' }],
    cr: [{ accountCode: '2100', amount: 300.0, description: 'Accounts payable' }],
  });

  // 6. Post the drafts
  section('6. POST ENTRIES');
  const draftIds = [entryA, entryB, entryC, entryD];
  const posted = [];
  for (const e of draftIds) {
    await api('POST', `/accounting/journal-entries/${e.id}/post`);
    posted.push(e);
    console.log(`  Posted ${e.entryNumber}`);
  }

  // 7. Show Cr/Dr info on a posted entry (detail returns per-line debit/credit)
  section('7. VERIFY Cr/Dr ON A POSTED ENTRY');
  const detail = await api('GET', `/accounting/journal-entries/${entryA.id}`);
  console.log(`  ${detail.entryNumber} (${detail.description})`);
  console.log(`    Status: ${detail.status}`);
  for (const l of detail.lines) {
    const dr = Number(l.debit) > 0 ? l.debit : '-';
    const cr = Number(l.credit) > 0 ? l.credit : '-';
    console.log(`      ${pad(l.account.code, 6)} ${pad(l.account.name, 28)} Dr ${pad(dr, 10)} Cr ${cr}`);
  }
  console.log(`    Total debit ${detail.totalDebit}  /  Total credit ${detail.totalCredit}  /  Diff ${detail.difference}`);

  // 8. Reverse one entry (the electricity payment) to show reversibility
  section('8. REVERSE A POSTED ENTRY');
  await api('POST', `/accounting/journal-entries/${entryC.id}/reverse`, {
    body: { reason: 'Demo: reversing electricity entry to illustrate reversals' },
  });
  const reversedDetail = await api('GET', `/accounting/journal-entries/${entryC.id}`);
  console.log(`  ${reversedDetail.entryNumber} is now ${reversedDetail.status}`);
  console.log(`  Reversal entry: ${reversedDetail.reversalEntry?.entryNumber ?? '(created)'}`);

  // 9. Profit & Loss report
  section('9. PROFIT & LOSS REPORT (from posted Dr/Cr lines)');
  const pnl = await api('GET', '/accounting/profit-loss', {
    query: { dateFrom: `${monthKey}-01`, dateTo: endIso },
  });
  console.log(`  Period: ${pnl.report.dateFrom} -> ${pnl.report.dateTo}`);
  for (const r of pnl.revenue) console.log(`    Revenue  ${pad(r.accountCode, 6)} ${pad(r.accountName, 30)} ${r.balance}`);
  for (const e of pnl.expenses) console.log(`    Expense  ${pad(e.accountCode, 6)} ${pad(e.accountName, 30)} ${e.balance}`);
  console.log(`    Total Revenue ${pnl.totals.revenue}   Total Expenses ${pnl.totals.expenses}   NET ${pnl.totals.netProfitLoss}`);

  // 10. Balance Sheet report (equation must balance)
  section('10. BALANCE SHEET (as of ' + endIso + ')');
  const bs = await api('GET', '/accounting/balance-sheet', { query: { dateTo: endIso } });
  console.log(`    Assets ${bs.totals.assets}`);
  console.log(`    Liabilities ${bs.totals.liabilities}`);
  console.log(`    Equity ${bs.totals.equity} + Current P&L ${bs.totals.currentProfitLoss}`);
  console.log(`    Difference ${bs.totals.difference}  (${bs.totals.balanced ? 'BALANCED' : 'NOT BALANCED'})`);

  console.log('\n' + '='.repeat(72));
  console.log('DEMO COMPLETE');
  console.log('='.repeat(72));
}

main().catch((error) => {
  console.error('\nDemo failed:', error.message);
  process.exitCode = 1;
});
