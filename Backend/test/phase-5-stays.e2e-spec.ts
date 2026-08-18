import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, type TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import {
  ALL_PERMISSIONS,
  ROLE_PERMISSION_MATRIX,
  SYSTEM_ROLES,
} from '../src/auth/auth.constants.js';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter.js';

interface Seed {
  hotelId: string;
  reservationId: string;
  roomId: string;
  serviceId: string;
}

describe('Phase 5 stays, service charges, folios, and checkout', () => {
  let app: NestExpressApplication;
  let pool: Pool;
  let seed: Seed;
  let passwordHash: string;
  let ipSequence = 100;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
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
    await pool.query('TRUNCATE TABLE "Permission", "Hotel" CASCADE');
    seed = await seedPhase5(pool, passwordHash);
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it('limits service pricing to management while Staff sees only active services', async () => {
    const staff = await token('staff');
    const manager = await token('manager');

    const denied = await api()
      .post('/api/v1/services')
      .auth(staff, { type: 'bearer' })
      .send({ name: 'Laundry', defaultPrice: '10.00' });
    expect(denied.status).toBe(403);

    const created = await api()
      .post('/api/v1/services')
      .auth(manager, { type: 'bearer' })
      .send({ name: 'Laundry', defaultPrice: '10.00' });
    expect(created.status).toBe(201);
    await api()
      .delete(`/api/v1/services/${created.body.id}`)
      .auth(manager, { type: 'bearer' })
      .expect(200);

    const staffList = await api().get('/api/v1/services').auth(staff, { type: 'bearer' });
    expect(staffList.status).toBe(200);
    expect(staffList.body.map((service: { name: string }) => service.name)).toEqual([
      'Airport transfer',
    ]);
    const managementList = await api().get('/api/v1/services').auth(manager, { type: 'bearer' });
    expect(managementList.body).toHaveLength(2);
  });

  it('runs an idempotent stay with price snapshots, retained voids, folio, and dirty rooms', async () => {
    const staff = await token('staff');
    const manager = await token('manager');

    const checkedIn = await api()
      .post(`/api/v1/reservations/${seed.reservationId}/check-in`)
      .auth(staff, { type: 'bearer' });
    expect(checkedIn.status).toBe(201);
    expect(checkedIn.body.alreadyCompleted).toBe(false);
    const repeatedCheckIn = await api()
      .post(`/api/v1/reservations/${seed.reservationId}/check-in`)
      .auth(staff, { type: 'bearer' });
    expect(repeatedCheckIn.body.alreadyCompleted).toBe(true);

    const originalCharge = await api()
      .post(`/api/v1/reservations/${seed.reservationId}/charges`)
      .auth(staff, { type: 'bearer' })
      .send({ serviceId: seed.serviceId, quantity: '2.00' });
    expect(originalCharge.status).toBe(201);
    expect(originalCharge.body).toMatchObject({ unitPrice: '25', totalAmount: '50' });

    await api()
      .patch(`/api/v1/services/${seed.serviceId}`)
      .auth(manager, { type: 'bearer' })
      .send({ defaultPrice: '30.00' })
      .expect(200);
    const laterCharge = await api()
      .post(`/api/v1/reservations/${seed.reservationId}/charges`)
      .auth(staff, { type: 'bearer' })
      .send({ serviceId: seed.serviceId, quantity: '1.00' });
    expect(laterCharge.body).toMatchObject({ unitPrice: '30', totalAmount: '30' });

    await api()
      .post(`/api/v1/charges/${laterCharge.body.id}/void`)
      .auth(staff, { type: 'bearer' })
      .send({ reason: 'Entered by mistake' })
      .expect(403);
    const voided = await api()
      .post(`/api/v1/charges/${laterCharge.body.id}/void`)
      .auth(manager, { type: 'bearer' })
      .send({ reason: 'Entered by mistake' });
    expect(voided.status).toBe(201);
    expect(voided.body.voided).toBe(true);

    const checkedOut = await api()
      .post(`/api/v1/reservations/${seed.reservationId}/check-out`)
      .auth(staff, { type: 'bearer' });
    expect(checkedOut.status).toBe(201);
    expect(checkedOut.body.folio).toMatchObject({
      subtotal: '250',
      total: '250',
      roomChargesPosted: true,
    });
    expect(checkedOut.body.folio.charges).toHaveLength(2);
    expect(
      checkedOut.body.folio.charges.find(
        (charge: { id: string }) => charge.id === laterCharge.body.id,
      ).voided,
    ).toBe(true);

    const repeatedCheckOut = await api()
      .post(`/api/v1/reservations/${seed.reservationId}/check-out`)
      .auth(staff, { type: 'bearer' });
    expect(repeatedCheckOut.body.alreadyCompleted).toBe(true);
    const state = await pool.query<{
      status: string;
      room_status: string;
      room_charges: string;
      service_charges: string;
      housekeeping_tasks: string;
    }>(
      `SELECT r.status, room.status AS room_status,
        (SELECT count(*) FROM "Charge" WHERE "reservationId" = r.id AND type = 'ROOM') AS room_charges,
        (SELECT count(*) FROM "Charge" WHERE "reservationId" = r.id AND type = 'SERVICE') AS service_charges
        ,(SELECT count(*) FROM "HousekeepingTask" WHERE "reservationId" = r.id) AS housekeeping_tasks
       FROM "Reservation" r
       JOIN "ReservationRoom" rr ON rr."reservationId" = r.id
       JOIN "Room" room ON room.id = rr."roomId"
       WHERE r.id = $1`,
      [seed.reservationId],
    );
    expect(state.rows[0]).toMatchObject({
      status: 'CHECKED_OUT',
      room_status: 'DIRTY',
      room_charges: '1',
      service_charges: '2',
      housekeeping_tasks: '1',
    });

    await expect(
      pool.query(`UPDATE "Charge" SET "totalAmount" = 1 WHERE id = $1`, [originalCharge.body.id]),
    ).rejects.toThrow(/immutable/i);
  });

  it('rolls back room charges, status, timestamps, history, and room state when checkout fails', async () => {
    const staff = await token('staff');
    await api()
      .post(`/api/v1/reservations/${seed.reservationId}/check-in`)
      .auth(staff, { type: 'bearer' })
      .expect(201);
    await pool.query(`UPDATE "Reservation" SET "discountAmount" = 999 WHERE id = $1`, [
      seed.reservationId,
    ]);

    const failed = await api()
      .post(`/api/v1/reservations/${seed.reservationId}/check-out`)
      .auth(staff, { type: 'bearer' });
    expect(failed.status).toBe(409);
    expect(failed.body.code).toBe('DISCOUNT_EXCEEDS_SUBTOTAL');

    const state = await pool.query<{
      status: string;
      checked_out_at: Date | null;
      room_status: string;
      charges: string;
      checkout_history: string;
    }>(
      `SELECT r.status, r."checkedOutAt" AS checked_out_at, room.status AS room_status,
        (SELECT count(*) FROM "Charge" WHERE "reservationId" = r.id) AS charges,
        (SELECT count(*) FROM "ReservationHistory"
          WHERE "reservationId" = r.id AND "toStatus" = 'CHECKED_OUT') AS checkout_history
       FROM "Reservation" r
       JOIN "ReservationRoom" rr ON rr."reservationId" = r.id
       JOIN "Room" room ON room.id = rr."roomId"
       WHERE r.id = $1`,
      [seed.reservationId],
    );
    expect(state.rows[0]).toMatchObject({
      status: 'CHECKED_IN',
      checked_out_at: null,
      room_status: 'OCCUPIED',
      charges: '0',
      checkout_history: '0',
    });
  });

  function api() {
    return request(app.getHttpServer());
  }

  async function token(username: string): Promise<string> {
    ipSequence += 1;
    const response = await api()
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .set('X-Forwarded-For', `10.50.60.${ipSequence}`)
      .send({ identifier: username, password: 'Strong Test Password 2026!' });
    expect(response.status).toBe(201);
    return String(response.body.accessToken);
  }
});

async function seedPhase5(pool: Pool, passwordHash: string): Promise<Seed> {
  const hotelId = randomUUID();
  await pool.query(
    `INSERT INTO "Hotel" (id, code, name, timezone, "updatedAt")
     VALUES ($1, 'PHASE5', 'Phase 5 Hotel', 'Europe/Moscow', now())`,
    [hotelId],
  );
  const permissionIds = new Map<string, string>();
  for (const key of ALL_PERMISSIONS) {
    const id = randomUUID();
    permissionIds.set(key, id);
    await pool.query(`INSERT INTO "Permission" (id, key) VALUES ($1, $2)`, [id, key]);
  }
  const roleIds = new Map<string, string>();
  for (const roleName of Object.values(SYSTEM_ROLES)) {
    const roleId = randomUUID();
    roleIds.set(roleName, roleId);
    await pool.query(
      `INSERT INTO "Role" (id, "hotelId", name, "isSystem", "updatedAt")
       VALUES ($1, $2, $3, true, now())`,
      [roleId, hotelId, roleName],
    );
    for (const permission of ROLE_PERMISSION_MATRIX[roleName]) {
      await pool.query(`INSERT INTO "RolePermission" ("roleId", "permissionId") VALUES ($1, $2)`, [
        roleId,
        required(permissionIds, permission),
      ]);
    }
  }
  for (const [username, roleName] of [
    ['admin', SYSTEM_ROLES.ADMIN],
    ['manager', SYSTEM_ROLES.MANAGER],
    ['staff', SYSTEM_ROLES.STAFF],
  ] as const) {
    const userId = randomUUID();
    await pool.query(
      `INSERT INTO "User"
        (id, "hotelId", email, username, "passwordHash", "fullName", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, now())`,
      [userId, hotelId, `${username}@phase5.test`, username, passwordHash, `${username} user`],
    );
    await pool.query(`INSERT INTO "UserRole" ("userId", "roleId") VALUES ($1, $2)`, [
      userId,
      required(roleIds, roleName),
    ]);
  }

  const guestId = randomUUID();
  const roomTypeId = randomUUID();
  const roomId = randomUUID();
  const reservationId = randomUUID();
  const reservationRoomId = randomUUID();
  const serviceId = randomUUID();
  const today = currentMoscowDate();
  const departure = addDays(today, 2);
  await pool.query(
    `INSERT INTO "Guest" (id, "hotelId", "fullName", "updatedAt")
     VALUES ($1, $2, 'Stay Guest', now())`,
    [guestId, hotelId],
  );
  await pool.query(
    `INSERT INTO "RoomType"
       (id, "hotelId", code, name, "capacityAdults", "capacityChildren", "basePrice", "updatedAt")
     VALUES ($1, $2, 'STD', 'Standard', 2, 1, 100, now())`,
    [roomTypeId, hotelId],
  );
  await pool.query(
    `INSERT INTO "Room" (id, "hotelId", "roomTypeId", "roomNumber", "updatedAt")
     VALUES ($1, $2, $3, '101', now())`,
    [roomId, hotelId, roomTypeId],
  );
  await pool.query(
    `INSERT INTO "Reservation"
       (id, "hotelId", "guestId", "bookingNumber", status, "checkInDate", "checkOutDate", adults, children, "updatedAt")
     VALUES ($1, $2, $3, 'RSV-260817-PH5001', 'CONFIRMED', $4::date, $5::date, 2, 0, now())`,
    [reservationId, hotelId, guestId, today, departure],
  );
  await pool.query(
    `INSERT INTO "ReservationRoom"
       (id, "reservationId", "roomId", "checkInDate", "checkOutDate", "nightlyRate", "bookingStatus", "updatedAt")
     VALUES ($1, $2, $3, $4::date, $5::date, 100, 'CONFIRMED', now())`,
    [reservationRoomId, reservationId, roomId, today, departure],
  );
  await pool.query(
    `INSERT INTO "Service" (id, "hotelId", name, "defaultPrice", "updatedAt")
     VALUES ($1, $2, 'Airport transfer', 25, now())`,
    [serviceId, hotelId],
  );
  return { hotelId, reservationId, roomId, serviceId };
}

function currentMoscowDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function required(map: Map<string, string>, key: string): string {
  const value = map.get(key);
  if (!value) throw new Error(`Missing mapping for ${key}`);
  return value;
}
