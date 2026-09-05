import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { Pool } from 'pg';
import request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module.js';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter.js';
import {
  ALL_PERMISSIONS,
  ROLE_PERMISSION_MATRIX,
  SYSTEM_ROLES,
} from '../src/auth/auth.constants.js';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';

interface Seed {
  hotelId: string;
  adminId: string;
  managerId: string;
  staffId: string;
  managerRoleId: string;
  staffRoleId: string;
  expenseAccountId: string;
  cashAccountId: string;
  apAccountId: string;
  expenseCategoryId: string;
  paymentMethodId: string;
}

describe('Expense approval workflow', () => {
  let app: NestExpressApplication;
  let pool: Pool;
  let seed: Seed;
  let passwordHash: string;
  let loginSequence = 100;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    passwordHash = await argon2.hash('Strong Test Password 2026!', {
      type: argon2.argon2id,
      memoryCost: 65_536,
      timeCost: 3,
      parallelism: 1,
    });
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication<NestExpressApplication>();
    app.set('trust proxy', true);
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new AllExceptionsFilter(app.get(Logger)));
    await app.init();
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE "Permission", "Hotel" CASCADE');
    seed = await seedTestData(pool, passwordHash);
  });

  afterAll(async () => {
    const httpServer = app?.getHttpServer();
    if (httpServer && typeof httpServer.close === 'function') {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
    await pool?.end();
  });

  function api() {
    return request(app.getHttpServer());
  }

  function login(identifier: string, password = 'Strong Test Password 2026!') {
    loginSequence += 1;
    return api()
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .set('X-Forwarded-For', `10.20.40.${loginSequence}`)
      .send({ identifier, password });
  }

  function expensePayload(overrides: Record<string, unknown> = {}) {
    return {
      categoryId: seed.expenseCategoryId,
      requestKey: randomUUID(),
      amount: '250.00',
      expenseDate: '2026-09-04',
      description: 'Office supplies',
      ...overrides,
    };
  }

  async function createExpense(
    token: string,
    overrides: Record<string, unknown> = {},
  ) {
    return api()
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send(expensePayload(overrides));
  }

  async function countExpenseJournalEntries() {
    const res = await pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM "JournalEntry" WHERE "sourceType" = 'HOTEL_EXPENSE' AND "hotelId" = $1`,
      [seed.hotelId],
    );
    return Number(res.rows[0].count);
  }

  describe('Expense approval workflow', () => {
    it('A: staff creates expense with SUBMITTED status and no journal entry', async () => {
      const staffLogin = await login('staff');
      const staffToken = String(staffLogin.body.accessToken);

      const res = await createExpense(staffToken);
      expect(res.status).toBe(201);
      expect(res.body.expense.status).toBe('SUBMITTED');

      const count = await countExpenseJournalEntries();
      expect(count).toBe(0);
    });

    it('B: staff cannot approve expense (missing expense.approve permission)', async () => {
      const staffLogin = await login('staff');
      const staffToken = String(staffLogin.body.accessToken);

      const created = await createExpense(staffToken);
      const expenseId = created.body.expense.id;

      const approveRes = await api()
        .post(`/api/v1/expenses/${expenseId}/approve`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ note: 'ok' });
      expect(approveRes.status).toBe(403);
      expect(approveRes.body.code).toBe('PERMISSION_DENIED');
    });

    it('C: manager approves staff-submitted expense', async () => {
      const staffLogin = await login('staff');
      const staffToken = String(staffLogin.body.accessToken);
      const managerLogin = await login('manager');
      const managerToken = String(managerLogin.body.accessToken);

      const created = await createExpense(staffToken);
      const expenseId = created.body.expense.id;

      const approveRes = await api()
        .post(`/api/v1/expenses/${expenseId}/approve`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ note: 'approved' });
      expect(approveRes.status).toBe(201);
      expect(approveRes.body.status).toBe('APPROVED');
    });

    it('D: self-approval is forbidden', async () => {
      const managerLogin = await login('manager');
      const managerToken = String(managerLogin.body.accessToken);

      const created = await createExpense(managerToken, {
        description: 'Manager own expense',
      });
      const expenseId = created.body.expense.id;

      const approveRes = await api()
        .post(`/api/v1/expenses/${expenseId}/approve`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ note: 'self approve' });
      expect(approveRes.status).toBe(409);
      expect(approveRes.body.code).toBe('EXPENSE_SELF_APPROVAL_FORBIDDEN');
    });

    it('E: manager pays approved expense and journal entry is created', async () => {
      const staffLogin = await login('staff');
      const staffToken = String(staffLogin.body.accessToken);
      const managerLogin = await login('manager');
      const managerToken = String(managerLogin.body.accessToken);

      const created = await createExpense(staffToken);
      const expenseId = created.body.expense.id;

      const approveRes = await api()
        .post(`/api/v1/expenses/${expenseId}/approve`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ note: 'approved' });
      expect(approveRes.status).toBe(201);

      const payRes = await api()
        .post(`/api/v1/expenses/${expenseId}/pay`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({});
      expect(payRes.status).toBe(201);
      expect(payRes.body.expense.status).toBe('PAID');
      expect(payRes.body.idempotentReplay).toBe(false);

      const count = await countExpenseJournalEntries();
      expect(count).toBe(1);

      const entry = await pool.query<{ status: string }>(
        `SELECT "status" FROM "JournalEntry" WHERE "sourceType" = 'HOTEL_EXPENSE' AND "hotelId" = $1`,
        [seed.hotelId],
      );
      expect(entry.rows[0].status).toBe('POSTED');
    });

    it('F: idempotent replay returns existing result without duplicate journal entry', async () => {
      const staffLogin = await login('staff');
      const staffToken = String(staffLogin.body.accessToken);
      const managerLogin = await login('manager');
      const managerToken = String(managerLogin.body.accessToken);

      const created = await createExpense(staffToken);
      const expenseId = created.body.expense.id;

      await api()
        .post(`/api/v1/expenses/${expenseId}/approve`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ note: 'approved' });

      await api()
        .post(`/api/v1/expenses/${expenseId}/pay`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({});

      const replayRes = await api()
        .post(`/api/v1/expenses/${expenseId}/pay`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({});
      expect(replayRes.status).toBe(201);
      expect(replayRes.body.idempotentReplay).toBe(true);
      expect(replayRes.body.expense.status).toBe('PAID');

      const count = await countExpenseJournalEntries();
      expect(count).toBe(1);
    });

    it('G: manager reverses paid expense', async () => {
      const staffLogin = await login('staff');
      const staffToken = String(staffLogin.body.accessToken);
      const managerLogin = await login('manager');
      const managerToken = String(managerLogin.body.accessToken);

      const created = await createExpense(staffToken);
      const expenseId = created.body.expense.id;

      await api()
        .post(`/api/v1/expenses/${expenseId}/approve`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ note: 'approved' });

      await api()
        .post(`/api/v1/expenses/${expenseId}/pay`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({});

      const reverseRes = await api()
        .post(`/api/v1/expenses/${expenseId}/reverse`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ reason: 'test reversal' });
      expect(reverseRes.status).toBe(201);
      expect(reverseRes.body.reversed).toBe(true);
    });

    it('H: manager rejects staff-submitted expense', async () => {
      const staffLogin = await login('staff');
      const staffToken = String(staffLogin.body.accessToken);
      const managerLogin = await login('manager');
      const managerToken = String(managerLogin.body.accessToken);

      const created = await createExpense(staffToken, {
        description: 'Expense to reject',
      });
      const expenseId = created.body.expense.id;

      const rejectRes = await api()
        .post(`/api/v1/expenses/${expenseId}/reject`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ reason: 'not valid' });
      expect(rejectRes.status).toBe(201);
      expect(rejectRes.body.status).toBe('REJECTED');
    });

    it('I: reversing a SUBMITTED expense fails', async () => {
      const staffLogin = await login('staff');
      const staffToken = String(staffLogin.body.accessToken);
      const managerLogin = await login('manager');
      const managerToken = String(managerLogin.body.accessToken);

      const created = await createExpense(staffToken, {
        description: 'Submitted only',
      });
      const expenseId = created.body.expense.id;
      expect(created.body.expense.status).toBe('SUBMITTED');

      const reverseRes = await api()
        .post(`/api/v1/expenses/${expenseId}/reverse`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ reason: 'cannot reverse submitted' });
      expect(reverseRes.status).toBe(409);
      expect(reverseRes.body.code).toBe('INVALID_EXPENSE_TRANSITION');
    });

    it('J: staff cannot pay expense (missing expense.pay permission)', async () => {
      const staffLogin = await login('staff');
      const staffToken = String(staffLogin.body.accessToken);
      const managerLogin = await login('manager');
      const managerToken = String(managerLogin.body.accessToken);

      const created = await createExpense(staffToken, {
        description: 'Staff pay attempt',
      });
      const expenseId = created.body.expense.id;

      await api()
        .post(`/api/v1/expenses/${expenseId}/approve`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ note: 'approved' });

      const payRes = await api()
        .post(`/api/v1/expenses/${expenseId}/pay`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({});
      expect(payRes.status).toBe(403);
      expect(payRes.body.code).toBe('PERMISSION_DENIED');
    });
  });
});

function requiredMapValue(map: Map<string, string>, key: string): string {
  const value = map.get(key);
  if (!value) throw new Error(`Missing test mapping for ${key}`);
  return value;
}

async function insertUser(
  pool: Pool,
  hotelId: string,
  username: string,
  passwordHash: string,
  roleId: string,
): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO "User"
      (id, "hotelId", email, username, "passwordHash", "fullName", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, now())`,
    [id, hotelId, `${username}@example.com`, username, passwordHash, `${username} user`],
  );
  await pool.query(`INSERT INTO "UserRole" ("userId", "roleId") VALUES ($1, $2)`, [id, roleId]);
  return id;
}

async function seedSecurityData(
  pool: Pool,
  passwordHash: string,
): Promise<{ hotelId: string; adminId: string; managerId: string; staffId: string }> {
  const hotelId = randomUUID();
  await pool.query(
    `INSERT INTO "Hotel" (id, code, name, "updatedAt") VALUES ($1, 'EXP-TEST', 'Expense Test Hotel', now())`,
    [hotelId],
  );

  const permissionIds = new Map<string, string>();
  for (const key of ALL_PERMISSIONS) {
    const id = randomUUID();
    permissionIds.set(key, id);
    await pool.query(`INSERT INTO "Permission" (id, key, description) VALUES ($1, $2, $3)`, [
      id,
      key,
      `Allows ${key}`,
    ]);
  }

  const roleIds = new Map<string, string>();
  for (const roleName of Object.values(SYSTEM_ROLES)) {
    const id = randomUUID();
    roleIds.set(roleName, id);
    await pool.query(
      `INSERT INTO "Role" (id, "hotelId", name, "isSystem", "updatedAt")
       VALUES ($1, $2, $3, true, now())`,
      [id, hotelId, roleName],
    );
    for (const permission of ROLE_PERMISSION_MATRIX[roleName]) {
      await pool.query(`INSERT INTO "RolePermission" ("roleId", "permissionId") VALUES ($1, $2)`, [
        id,
        requiredMapValue(permissionIds, permission),
      ]);
    }
  }

  const adminId = await insertUser(
    pool, hotelId, 'admin', passwordHash,
    requiredMapValue(roleIds, SYSTEM_ROLES.ADMIN),
  );
  const managerId = await insertUser(
    pool, hotelId, 'manager', passwordHash,
    requiredMapValue(roleIds, SYSTEM_ROLES.MANAGER),
  );
  const staffId = await insertUser(
    pool, hotelId, 'staff', passwordHash,
    requiredMapValue(roleIds, SYSTEM_ROLES.STAFF),
  );

  return { hotelId, adminId, managerId, staffId };
}

async function seedAccountingData(
  pool: Pool,
  hotelId: string,
): Promise<{
  expenseAccountId: string;
  cashAccountId: string;
  apAccountId: string;
  expenseCategoryId: string;
  paymentMethodId: string;
}> {
  const expenseAccountId = randomUUID();
  await pool.query(
    `INSERT INTO "Account" (id, "hotelId", code, name, type, "normalBalance", currency, "isActive", "allowManualPosting", "updatedAt")
     VALUES ($1, $2, '5000', 'Expenses', 'EXPENSE', 'DEBIT', 'USD', true, true, now())`,
    [expenseAccountId, hotelId],
  );

  const cashAccountId = randomUUID();
  await pool.query(
    `INSERT INTO "Account" (id, "hotelId", code, name, type, "normalBalance", currency, "isActive", "allowManualPosting", "updatedAt")
     VALUES ($1, $2, '1000', 'Cash', 'ASSET', 'DEBIT', 'USD', true, true, now())`,
    [cashAccountId, hotelId],
  );

  const apAccountId = randomUUID();
  await pool.query(
    `INSERT INTO "Account" (id, "hotelId", code, name, type, "normalBalance", currency, "isActive", "allowManualPosting", "updatedAt")
     VALUES ($1, $2, '2000', 'Accounts Payable', 'LIABILITY', 'CREDIT', 'USD', true, true, now())`,
    [apAccountId, hotelId],
  );

  const settingsId = randomUUID();
  await pool.query(
    `INSERT INTO "AccountingSettings" (
       id, "hotelId",
       "defaultRoomRevenueAccountId", "defaultGuestReceivableAccountId",
       "defaultCashAccountId", "defaultBankAccountId",
       "defaultMobileMoneyAccountId", "defaultDepositAccountId",
       "defaultTaxPayableAccountId", "defaultServiceRevenueAccountId",
       "defaultDiscountAccountId", "defaultExpenseAccountId",
       "defaultAccountsPayableAccountId",
       "baseCurrency", "discountPostingMode", "updatedAt"
     ) VALUES (
       $1, $2,
       $3, $3, $3, $3, $3, $3, $3, $3, $3, $4, $5,
       'USD', 'CONTRA_REVENUE', now()
     )`,
    [settingsId, hotelId, cashAccountId, expenseAccountId, apAccountId],
  );

  const journalId = randomUUID();
  await pool.query(
    `INSERT INTO "AccountingJournal" (id, "hotelId", code, name, type, "isActive", "updatedAt")
     VALUES ($1, $2, 'PURCHASE', 'Purchases', 'PURCHASE', true, now())`,
    [journalId, hotelId],
  );

  const expenseCategoryId = randomUUID();
  await pool.query(
    `INSERT INTO "ExpenseCategory" (id, "hotelId", name, "isActive", "expenseAccountId", "updatedAt")
     VALUES ($1, $2, 'Supplies', true, $3, now())`,
    [expenseCategoryId, hotelId, expenseAccountId],
  );

  const paymentMethodId = randomUUID();
  await pool.query(
    `INSERT INTO "PaymentMethod" (id, "hotelId", name, "isActive", "ledgerAccountId", "updatedAt")
     VALUES ($1, $2, 'Cash', true, $3, now())`,
    [paymentMethodId, hotelId, cashAccountId],
  );

  return { expenseAccountId, cashAccountId, apAccountId, expenseCategoryId, paymentMethodId };
}

async function seedTestData(pool: Pool, passwordHash: string): Promise<Seed> {
  const security = await seedSecurityData(pool, passwordHash);
  const accounting = await seedAccountingData(pool, security.hotelId);
  return { ...security, ...accounting };
}
