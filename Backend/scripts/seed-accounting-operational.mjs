import 'dotenv/config';
import { createHash } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const BASE = (process.env.API_BASE ?? 'http://localhost:3001/api/v1').replace(/\/$/, '');
const args = Object.fromEntries(process.argv.slice(2).filter((value) => value.startsWith('--')).map((value) => {
  const [key, ...rest] = value.slice(2).split('=');
  return [key, rest.join('=') || 'true'];
}));
const IDENTIFIER = args.identifier ?? process.env.DEMO_ADMIN_IDENTIFIER ?? 'testadmin';
const PASSWORD = args.password ?? process.env.DEMO_ADMIN_PASSWORD ?? 'TestAdmin2026!';
const ORIGIN = process.env.ORIGIN ?? 'http://localhost:3000';
const seed = args.seed ?? 'ACCOUNTING-SEED-2026';
const seedTag = seed.toUpperCase().replaceAll(/[^A-Z0-9]/g, '').slice(-16);
let accessToken;
const database = process.env.DATABASE_URL ? new pg.Pool({ connectionString: process.env.DATABASE_URL }) : null;

async function api(method, path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Origin: ORIGIN,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status}: ${JSON.stringify(data)}`);
  return data;
}

const list = (value) => value?.data ?? value?.items ?? value ?? [];
const money = (value) => Number(value ?? 0);
const key = (label) => `${seed}:${label}`;
const OPENING_BALANCE_SOURCE_ID = '6f2c5f54-7c12-4cb5-9f6f-202609020001';

async function findOrCreateGuest(index) {
  const slug = seed.toLowerCase().replaceAll(/[^a-z0-9]/g, '-');
  const fullName = `${seed} Guest ${index}`;
  const email = `${slug}.${index}@example.com`;
  const phone = `+252611${(100000 + (parseInt(createHash('sha256').update(`${seed}:${index}`).digest('hex').slice(0, 8), 16) % 900000)).toString()}`;
  const existing = await findSeedGuest(email, phone);
  if (existing) return existing;
  return api('POST', '/guests', {
    fullName,
    email,
    phone,
    nationality: 'Somalia',
  });
}

async function findSeedGuest(email, phone) {
  if (!database) return null;
  const result = await database.query(
    `SELECT id, "fullName", email, phone FROM "Guest"
     WHERE email = $1 OR phone = $2 ORDER BY "createdAt" DESC LIMIT 1`,
    [email, phone],
  );
  return result.rows[0] ?? null;
}

async function findOrCreatePaymentMethod(name, ledgerAccountId) {
  const methods = list(await api('GET', '/payment-methods'));
  const existing = methods.find((method) => method.name === name);
  if (existing) {
    if (existing.ledgerAccountId !== ledgerAccountId) return api('PATCH', `/payment-methods/${existing.id}`, { name, ledgerAccountId });
    return existing;
  }
  return api('POST', '/payment-methods', { name, ledgerAccountId });
}

async function ensureMasterData() {
  const roomTypes = list(await api('GET', '/room-types'));
  const roomType = roomTypes.find((value) => value.code === `${seedTag}STD`) ?? await api('POST', '/room-types', {
    code: `${seedTag}STD`, name: `${seed} Standard`, description: 'Operational accounting seed room type',
    capacityAdults: 2, capacityChildren: 1, basePrice: '150.00',
  });
  const floors = list(await api('GET', '/floors'));
  const floor = floors.find((value) => value.name === `${seed} Floor`) ?? await api('POST', '/floors', {
    number: floors.reduce((maximum, value) => Math.max(maximum, Number(value.number)), 0) + 1,
    name: `${seed} Floor`,
  });
  const createdRooms = [];
  for (const roomNumber of [`${seedTag}1`, `${seedTag}2`, `${seedTag}3`, `${seedTag}4`]) {
    const existing = list(await api('GET', `/rooms?search=${encodeURIComponent(roomNumber)}&limit=10`))
      .find((room) => room.roomNumber === roomNumber);
    if (existing) {
      createdRooms.push(existing);
      continue;
    }
    try {
      createdRooms.push(await api('POST', '/rooms', { roomNumber, roomTypeId: roomType.id, floorId: floor.id, notes: `${seed}: room` }));
    } catch (error) {
      if (!String(error.message).includes('DUPLICATE_RESOURCE')) throw error;
      const resolved = list(await api('GET', `/rooms?search=${encodeURIComponent(roomNumber)}&limit=10`))
        .find((room) => room.roomNumber === roomNumber);
      if (!resolved) throw error;
      createdRooms.push(resolved);
    }
  }
  const services = list(await api('GET', '/services'));
  const service = services.find((value) => value.name === `${seed} Breakfast`) ?? await api('POST', '/services', {
    name: `${seed} Breakfast`, description: 'Operational accounting seed service', defaultPrice: '40.00',
  });
  const categories = list(await api('GET', '/expense-categories'));
  const category = categories.find((value) => value.name === `${seed} Operations`) ?? await api('POST', '/expense-categories', {
    name: `${seed} Operations`, expenseAccountId: null,
  });
  return { rooms: createdRooms, service, category };
}

async function createReservation(guestId, roomId, label, discountAmount = '0.00') {
  const existing = await findSeedReservation(label);
  if (existing) {
    if (existing.status === 'PENDING') await api('POST', `/reservations/${existing.id}/confirm`);
    if (existing.status === 'PENDING' || existing.status === 'CONFIRMED') await api('POST', `/reservations/${existing.id}/check-in`);
    return existing;
  }
  const today = new Date();
  const checkIn = today.toISOString().slice(0, 10);
  const checkoutDate = new Date(today.getTime() + 86400000 * 2).toISOString().slice(0, 10);
  const reservation = await api('POST', '/reservations', {
    guestId, roomIds: [roomId], checkInDate: checkIn, checkOutDate: checkoutDate,
    adults: 2, children: 0, notes: `${seed}:${label}`,
  });
  await api('POST', `/reservations/${reservation.id}/confirm`);
  await api('POST', `/reservations/${reservation.id}/check-in`);
  if (discountAmount !== '0.00') await api('PATCH', `/reservations/${reservation.id}/discount`, { amount: discountAmount });
  return reservation;
}

async function findSeedReservation(label) {
  if (!database) return null;
  const result = await database.query(
    `SELECT r.id, r.status, rr."roomId"
     FROM "Reservation" r
     LEFT JOIN "ReservationRoom" rr ON rr."reservationId" = r.id
     WHERE r.notes = $1
     ORDER BY r."createdAt" DESC LIMIT 1`,
    [`${seed}:${label}`],
  );
  const row = result.rows[0];
  return row ? { id: row.id, status: row.status, rooms: row.roomId ? [{ roomId: row.roomId }] : [] } : null;
}

async function issueInvoice(reservation, serviceId) {
  const existingInvoices = list(await api('GET', '/invoices?limit=100'));
  const existingInvoice = existingInvoices.find((invoice) => invoice.reservation?.id === reservation.id);
  if (existingInvoice) return { serviceCharge: null, invoice: existingInvoice };
  const serviceCharge = await api('POST', `/reservations/${reservation.id}/charges`, { serviceId, quantity: '1' });
  await api('POST', `/reservations/${reservation.id}/check-out`);
  const invoiceResponse = await api('POST', `/reservations/${reservation.id}/invoice`);
  const invoice = invoiceResponse.invoice ?? invoiceResponse;
  return { serviceCharge, invoice };
}

async function createPayment(reservation, paymentMethod, amount, label) {
  const existingPayments = list(await api('GET', `/reservations/${reservation.id}/payments`));
  const existing = existingPayments.find((payment) => payment.reference === `${seed}:${label}`);
  if (existing) return existing;
  return api('POST', '/payments', {
    reservationId: reservation.id, paymentMethodId: paymentMethod.id, amount,
    requestKey: randomUUID(), reference: `${seed}:${label}`, note: 'Operational accounting seed payment',
  });
}

async function createExpense(categoryId, paymentMethodId, amount, label, date) {
  const existingExpenses = list(await api('GET', '/expenses?limit=100'));
  const existing = existingExpenses.find((expense) => expense.reference === `${seed}:${label}`);
  if (existing) return existing;
  return api('POST', '/expenses', {
    categoryId, paymentMethodId, amount, expenseDate: date,
    description: `${seed}: ${label}`, reference: `${seed}:${label}`, requestKey: randomUUID(),
  });
}

async function main() {
  const login = await api('POST', '/auth/login', { identifier: IDENTIFIER, password: PASSWORD });
  accessToken = login.accessToken;
  await api('POST', '/accounting/settings/initialize');
  const accounts = list(await api('GET', '/accounting/accounts?limit=100'));
  const byCode = new Map(accounts.map((account) => [account.code, account]));
  for (const code of ['1110', '1120', '1130', '1200', '2200', '3100', '4090', '4100', '4500', '6900']) {
    if (!byCode.has(code)) throw new Error(`Required account ${code} is missing.`);
  }
  const journals = list(await api('GET', '/accounting/journals?limit=100'));
  const generalJournal = journals.find((journal) => journal.code === 'GEN');
  if (!generalJournal) throw new Error('General accounting journal is missing.');
  await api('POST', '/accounting/journal-entries/opening-balance', {
    journalId: generalJournal.id,
    businessDate: new Date().toISOString().slice(0, 10),
    sourceId: OPENING_BALANCE_SOURCE_ID,
    reference: `${seed}:OPENING-CAPITAL`,
    description: `${seed}: opening owner capital`,
    lines: [
      { accountId: byCode.get('1110').id, description: 'Opening cash capital', debit: '20000.00', credit: '0' },
      { accountId: byCode.get('3100').id, description: 'Owner equity', debit: '0', credit: '20000.00' },
    ],
  });
  const cash = await findOrCreatePaymentMethod('Seed Cash', byCode.get('1110').id);
  const bank = await findOrCreatePaymentMethod('Seed Bank', byCode.get('1120').id);
  const mobile = await findOrCreatePaymentMethod('Seed Mobile Money', byCode.get('1130').id);
  const masterData = await ensureMasterData();
  const rooms = masterData.rooms;
  const service = masterData.service;
  const guests = await Promise.all([1, 2, 3].map(findOrCreateGuest));
  const existingForSeed = (label) => findSeedReservation(label);
  const availableRooms = rooms.filter((room) => room.status === 'AVAILABLE');
  const existingLabels = await Promise.all(['FULL-CASH', 'FULL-BANK', 'PARTIAL-MOBILE', 'UNPAID'].map(async (label) => [label, await existingForSeed(label)]));
  const existingByLabel = new Map(existingLabels);
  if (availableRooms.length < 4 && existingLabels.some(([, reservation]) => !reservation)) {
    throw new Error('Operational seed requires four available rooms for new scenarios.');
  }
  const roomFor = (label, index) => existingByLabel.get(label)?.rooms?.[0]?.roomId ?? availableRooms[index]?.id;
  const first = await createReservation(guests[0].id, roomFor('FULL-CASH', 0), 'FULL-CASH', '10.00');
  const second = await createReservation(guests[1].id, roomFor('FULL-BANK', 1), 'FULL-BANK');
  const third = await createReservation(guests[2].id, roomFor('PARTIAL-MOBILE', 2), 'PARTIAL-MOBILE');
  const fourth = await createReservation(guests[0].id, roomFor('UNPAID', 3), 'UNPAID');
  const fullCash = await issueInvoice(first, service.id);
  const fullCashPayment = await createPayment(first, cash, money(fullCash.invoice.totalAmount).toFixed(2), 'FULL-CASH');
  const fullCashPaymentId = fullCashPayment.payment?.id ?? fullCashPayment.id;
  const refund = await createRefund(fullCashPaymentId, '10.00');
  const bankResult = await issueInvoice(second, service.id);
  const bankPayment = await createPayment(second, bank, money(bankResult.invoice.totalAmount).toFixed(2), 'FULL-BANK');
  const partialResult = await issueInvoice(third, service.id);
  const partialPayment = await createPayment(third, mobile, '50.00', 'PARTIAL-MOBILE');
  const unpaidResult = await issueInvoice(fourth, service.id);
  const today = new Date().toISOString().slice(0, 10);
  const expenses = await Promise.all([
    createExpense(masterData.category.id, cash.id, '125.00', 'Cleaning supplies', today),
    createExpense(masterData.category.id, bank.id, '850.00', 'Utilities', today),
    createExpense(masterData.category.id, null, '400.00', 'Supplier payable', today),
  ]);
  const trialBalance = await api('GET', `/accounting/trial-balance?dateFrom=${today}&dateTo=${today}`);
  const profitLoss = await api('GET', `/accounting/profit-loss?dateFrom=${today}&dateTo=${today}`);
  const balanceSheet = await api('GET', `/accounting/balance-sheet?dateTo=${today}`);
  const debit = money(trialBalance.totals?.totalDebit ?? trialBalance.totalDebit);
  const credit = money(trialBalance.totals?.totalCredit ?? trialBalance.totalCredit);
  if (Math.abs(debit - credit) > 0.005) throw new Error(`Trial balance is unbalanced: debit=${debit} credit=${credit}`);
  if (!money(profitLoss.totals?.revenue) || !money(profitLoss.totals?.expenses)) throw new Error('Seed must produce revenue and expenses.');
  if (balanceSheet.totals?.balanced === false) throw new Error(`Balance sheet is unbalanced: ${JSON.stringify(balanceSheet.totals)}`);
  console.log(JSON.stringify({
    seed, hotel: login.user?.hotelName ?? 'active hotel', reservations: 4, invoices: 4,
    payments: 3, refunds: 1, unpaidInvoice: unpaidResult.invoice.id, expenses: expenses.length, refund: refund.refund?.id ?? refund.id,
    trialBalance: { debit: debit.toFixed(2), credit: credit.toFixed(2), difference: (debit - credit).toFixed(2) },
    revenue: profitLoss.totals.revenue, expensesTotal: profitLoss.totals.expenses,
    netProfit: profitLoss.totals.netProfitLoss, balanceSheet: balanceSheet.totals,
    note: 'Run with --seed=<same value> after adding per-record reconciliation for a full idempotent rerun.',
  }, null, 2));
  await database?.end();
}

async function createRefund(paymentId, amount) {
  const payment = await api('GET', `/payments/${paymentId}`);
  const refunds = list(await api('GET', `/reservations/${payment.reservationId}/payments`));
  const existing = refunds.find((value) => value.kind === 'REFUND' && value.note === 'Operational accounting seed refund');
  if (existing) return existing;
  return api('POST', `/payments/${paymentId}/refunds`, {
    amount, requestKey: randomUUID(), reason: 'Operational accounting seed refund',
  });
}

main().catch((error) => {
  console.error(`ACCOUNTING SEED FAILED: ${error.message}`);
  process.exitCode = 1;
});
