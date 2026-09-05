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
  roomId: string;
}

describe('Maintenance workflow', () => {
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
      .set('X-Forwarded-For', `10.20.50.${loginSequence}`)
      .send({ identifier, password });
  }

  async function createRequest(token: string, overrides: Record<string, unknown> = {}) {
    return api()
      .post('/api/v1/maintenance/requests')
      .set('Authorization', `Bearer ${token}`)
      .send({
        roomId: seed.roomId,
        problem: 'Broken shower head',
        category: 'Plumbing',
        priority: 'HIGH',
        ...overrides,
      });
  }

  async function post(token: string, id: string, path: string, body: Record<string, unknown> = {}) {
    return api()
      .post(`/api/v1/maintenance/requests/${id}${path}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  }

  async function getStatus(id: string): Promise<string | null> {
    const res = await pool.query<{ status: string }>(
      `SELECT "status" FROM "MaintenanceRequest" WHERE "id" = $1`,
      [id],
    );
    return res.rows[0]?.status ?? null;
  }

  async function getRoomStatus(roomId: string): Promise<string> {
    const res = await pool.query<{ status: string }>(
      `SELECT "status" FROM "Room" WHERE "id" = $1`,
      [roomId],
    );
    return res.rows[0].status;
  }

  describe('Maintenance workflow', () => {
    it('A: staff creates a request with OPEN status, category and priority', async () => {
      const token = String((await login('staff')).body.accessToken);
      const res = await createRequest(token);
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('OPEN');
      expect(res.body.category).toBe('Plumbing');
      expect(res.body.priority).toBe('HIGH');
    });

    it('B: staff cannot start a request (missing maintenance.update)', async () => {
      const token = String((await login('staff')).body.accessToken);
      const created = await createRequest(token);
      const id = created.body.id;

      const res = await post(token, id, '/start');
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('PERMISSION_DENIED');
    });

    it('C: assign moves OPEN to ASSIGNED', async () => {
      const managerToken = String((await login('manager')).body.accessToken);
      const created = await createRequest(managerToken);
      const id = created.body.id;

      const res = await post(managerToken, id, '/assign', { assignedToId: seed.staffId });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('ASSIGNED');
      expect(res.body.assignedToId).toBe(seed.staffId);
      expect(res.body.assignedAt).toBeTruthy();
    });

    it('D: full lifecycle start->hold->resume->complete->verify->close returns room to service', async () => {
      const managerToken = String((await login('manager')).body.accessToken);
      const created = await createRequest(managerToken);
      const id = created.body.id;
      expect(await getRoomStatus(seed.roomId)).toBe('AVAILABLE');

      const start = await post(managerToken, id, '/start');
      expect(start.status).toBe(201);
      expect(start.body.status).toBe('IN_PROGRESS');
      expect(await getRoomStatus(seed.roomId)).toBe('MAINTENANCE');

      const hold = await post(managerToken, id, '/hold', { reason: 'waiting for parts' });
      expect(hold.status).toBe(201);
      expect(hold.body.status).toBe('ON_HOLD');

      const resume = await post(managerToken, id, '/resume');
      expect(resume.status).toBe(201);
      expect(resume.body.status).toBe('IN_PROGRESS');

      const complete = await post(managerToken, id, '/complete', { cost: '75.00', notes: 'fixed' });
      expect(complete.status).toBe(201);
      expect(complete.body.status).toBe('COMPLETED');
      expect(complete.body.completedById).toBeTruthy();
      expect(await getStatus(id)).toBe('COMPLETED');
      expect(await getRoomStatus(seed.roomId)).toBe('MAINTENANCE');

      const verify = await post(managerToken, id, '/verify');
      expect(verify.status).toBe(201);
      expect(verify.body.status).toBe('VERIFIED');

      const close = await post(managerToken, id, '/close');
      expect(close.status).toBe(201);
      expect(close.body.status).toBe('CLOSED');
      expect(await getRoomStatus(seed.roomId)).toBe('AVAILABLE');
    });

    it('E: completing with a cost auto-creates an approved expense linked to the maintenance', async () => {
      const managerToken = String((await login('manager')).body.accessToken);
      const created = await createRequest(managerToken);
      const id = created.body.id;

      await post(managerToken, id, '/start');
      const complete = await post(managerToken, id, '/complete', { cost: '120.00' });
      expect(complete.status).toBe(201);

      const expense = await pool.query<{ maintenanceId: string; status: string; amount: string }>(
        `SELECT "maintenanceId", "status", "amount"::text FROM "Expense" WHERE "maintenanceId" = $1`,
        [id],
      );
      expect(expense.rows.length).toBe(1);
      expect(expense.rows[0].status).toBe('APPROVED');
      expect(expense.rows[0].amount).toBe('120.00');

      const journal = await pool.query<{ count: string }>(
        `SELECT COUNT(*) FROM "JournalEntry" WHERE "sourceType" = 'HOTEL_EXPENSE' AND "hotelId" = $1`,
        [seed.hotelId],
      );
      expect(Number(journal.rows[0].count)).toBe(1);
    });

    it('F: start directly from OPEN (no assignment) works and assigns the actor', async () => {
      const managerToken = String((await login('manager')).body.accessToken);
      const created = await createRequest(managerToken);
      const id = created.body.id;

      const start = await post(managerToken, id, '/start');
      expect(start.status).toBe(201);
      expect(start.body.status).toBe('IN_PROGRESS');
      expect(start.body.assignedToId).toBe(seed.managerId);
      expect(start.body.assignedAt).toBeTruthy();
    });

    it('G: cancel from OPEN moves to CANCELLED with a reason', async () => {
      const managerToken = String((await login('manager')).body.accessToken);
      const created = await createRequest(managerToken);
      const id = created.body.id;

      const cancel = await post(managerToken, id, '/cancel', { reason: 'no longer needed' });
      expect(cancel.status).toBe(201);
      expect(cancel.body.status).toBe('CANCELLED');
      expect(cancel.body.cancelReason).toBe('no longer needed');
    });

    it('H: invalid transition fails (verify before complete)', async () => {
      const managerToken = String((await login('manager')).body.accessToken);
      const created = await createRequest(managerToken);
      const id = created.body.id;

      const verify = await post(managerToken, id, '/verify');
      expect(verify.status).toBe(409);
      expect(verify.body.code).toBe('INVALID_MAINTENANCE_TRANSITION');
    });

    it('I: cancel without a reason is rejected by validation', async () => {
      const managerToken = String((await login('manager')).body.accessToken);
      const created = await createRequest(managerToken);
      const id = created.body.id;

      const cancel = await post(managerToken, id, '/cancel', {});
      expect(cancel.status).toBe(400);
    });

    it('J: close without verify fails and room stays in maintenance', async () => {
      const managerToken = String((await login('manager')).body.accessToken);
      const created = await createRequest(managerToken);
      const id = created.body.id;

      await post(managerToken, id, '/start');
      await post(managerToken, id, '/complete', { cost: '10.00' });

      const close = await post(managerToken, id, '/close');
      expect(close.status).toBe(409);
      expect(close.body.code).toBe('INVALID_MAINTENANCE_TRANSITION');
      expect(await getRoomStatus(seed.roomId)).toBe('MAINTENANCE');
    });

    it('K: start auto-cancels PENDING booking and completes cleaning task', async () => {
      const guestId = randomUUID();
      await pool.query(
        `INSERT INTO "Guest" (id, "hotelId", "fullName", "updatedAt")
         VALUES ($1, $2, 'Test Guest', now())`,
        [guestId, seed.hotelId],
      );
      const reservationId = randomUUID();
      await pool.query(
        `INSERT INTO "Reservation" (id, "hotelId", "guestId", "bookingNumber", "checkInDate", "checkOutDate", "updatedAt")
         VALUES ($1, $2, $3, 'RSV-000001-ABCDEF', CURRENT_DATE, CURRENT_DATE + 3, now())`,
        [reservationId, seed.hotelId, guestId],
      );
      await pool.query(
        `INSERT INTO "ReservationRoom" (id, "reservationId", "roomId", "checkInDate", "checkOutDate", "nightlyRate", "bookingStatus", "updatedAt")
         VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_DATE + 3, '100.00', 'PENDING', now())`,
        [randomUUID(), reservationId, seed.roomId],
      );
      await pool.query(
        `INSERT INTO "HousekeepingTask" (id, "hotelId", "roomId", status, "updatedAt")
         VALUES ($1, $2, $3, 'DIRTY', now())`,
        [randomUUID(), seed.hotelId, seed.roomId],
      );

      const managerToken = String((await login('manager')).body.accessToken);
      const created = await createRequest(managerToken);
      const id = created.body.id;

      const start = await post(managerToken, id, '/start');
      expect(start.status).toBe(201);
      expect(start.body.status).toBe('IN_PROGRESS');
      expect(await getRoomStatus(seed.roomId)).toBe('MAINTENANCE');

      const reservation = await pool.query<{ status: string }>(
        `SELECT "status" FROM "Reservation" WHERE "id" = $1`,
        [reservationId],
      );
      expect(reservation.rows[0].status).toBe('CANCELLED');

      const cleaning = await pool.query<{ status: string }>(
        `SELECT status FROM "HousekeepingTask" WHERE "roomId" = $1`,
        [seed.roomId],
      );
      expect(cleaning.rows[0].status).toBe('COMPLETED');
    });

    it('L: start fails with CHECKED_IN booking', async () => {
      const guestId = randomUUID();
      await pool.query(
        `INSERT INTO "Guest" (id, "hotelId", "fullName", "updatedAt")
         VALUES ($1, $2, 'Checked In Guest', now())`,
        [guestId, seed.hotelId],
      );
      const reservationId = randomUUID();
      await pool.query(
        `INSERT INTO "Reservation" (id, "hotelId", "guestId", "bookingNumber", "status", "checkInDate", "checkOutDate", "checkedInAt", "updatedAt")
         VALUES ($1, $2, $3, 'RSV-000002-GHIJKL', 'CHECKED_IN', CURRENT_DATE, CURRENT_DATE + 2, now(), now())`,
        [reservationId, seed.hotelId, guestId],
      );
      await pool.query(
        `INSERT INTO "ReservationRoom" (id, "reservationId", "roomId", "checkInDate", "checkOutDate", "nightlyRate", "bookingStatus", "updatedAt")
         VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_DATE + 2, '100.00', 'CHECKED_IN', now())`,
        [randomUUID(), reservationId, seed.roomId],
      );

      const managerToken = String((await login('manager')).body.accessToken);
      const created = await createRequest(managerToken);
      const id = created.body.id;

      const start = await post(managerToken, id, '/start');
      expect(start.status).toBe(409);
      expect(start.body.code).toBe('ROOM_HAS_ACTIVE_WORK_OR_BOOKING');
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
    `INSERT INTO "Hotel" (id, code, name, "updatedAt") VALUES ($1, 'MAINT-TEST', 'Maintenance Test Hotel', now())`,
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

async function seedRoom(pool: Pool, hotelId: string): Promise<string> {
  const roomTypeId = randomUUID();
  await pool.query(
    `INSERT INTO "RoomType" (id, "hotelId", code, name, "capacityAdults", "basePrice", "updatedAt")
     VALUES ($1, $2, 'STD', 'Standard', 2, '50.00', now())`,
    [roomTypeId, hotelId],
  );
  const roomId = randomUUID();
  await pool.query(
    `INSERT INTO "Room" (id, "hotelId", "roomTypeId", "roomNumber", status, "updatedAt")
     VALUES ($1, $2, $3, '101', 'AVAILABLE', now())`,
    [roomId, hotelId, roomTypeId],
  );
  return roomId;
}

async function seedAccountingData(pool: Pool, hotelId: string): Promise<void> {
  const expenseAccountId = randomUUID();
  await pool.query(
    `INSERT INTO "Account" (id, "hotelId", code, name, type, "normalBalance", currency, "isActive", "allowManualPosting", "updatedAt")
     VALUES ($1, $2, '5000', 'Expenses', 'EXPENSE', 'DEBIT', 'USD', true, true, now())`,
    [expenseAccountId, hotelId],
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
    [settingsId, hotelId, apAccountId, expenseAccountId, apAccountId],
  );
  const journalId = randomUUID();
  await pool.query(
    `INSERT INTO "AccountingJournal" (id, "hotelId", code, name, type, "isActive", "updatedAt")
     VALUES ($1, $2, 'PURCHASE', 'Purchases', 'PURCHASE', true, now())`,
    [journalId, hotelId],
  );
}

async function seedTestData(pool: Pool, passwordHash: string): Promise<Seed> {
  const security = await seedSecurityData(pool, passwordHash);
  const roomId = await seedRoom(pool, security.hotelId);
  await seedAccountingData(pool, security.hotelId);
  return { ...security, roomId };
}
