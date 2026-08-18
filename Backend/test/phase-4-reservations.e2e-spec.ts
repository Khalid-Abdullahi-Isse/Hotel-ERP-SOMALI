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
  guestId: string;
  secondGuestId: string;
  standardTypeId: string;
  luxuryTypeId: string;
  room101Id: string;
  room102Id: string;
  room201Id: string;
}

describe('Phase 4 guests, availability, and reservations', () => {
  let app: NestExpressApplication;
  let pool: Pool;
  let seed: Seed;
  let passwordHash: string;
  let ipSequence = 50;

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
    seed = await seedPhase4(pool, passwordHash);
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it('hard-blocks duplicate identity documents and audits an intentional shared-phone guest', async () => {
    const staff = await token('staff');
    const strongDuplicate = await api()
      .post('/api/v1/guests')
      .auth(staff, { type: 'bearer' })
      .send({
        fullName: 'Duplicate Passport',
        passportNumber: ' p-100 ',
        phone: '+252 61 100 0000',
      });
    expect(strongDuplicate.status).toBe(409);
    expect(strongDuplicate.body.code).toBe('GUEST_IDENTIFIER_EXISTS');

    const weakDuplicate = await api()
      .post('/api/v1/guests')
      .auth(staff, { type: 'bearer' })
      .send({ fullName: 'Family Member', phone: '+252 61 100 0000' });
    expect(weakDuplicate.status).toBe(409);
    expect(weakDuplicate.body.code).toBe('POSSIBLE_DUPLICATE_GUEST');
    expect(weakDuplicate.body.details.candidates).toHaveLength(1);

    const allowed = await api().post('/api/v1/guests').auth(staff, { type: 'bearer' }).send({
      fullName: 'Family Member',
      phone: '+252 61 100 0000',
      allowPossibleDuplicate: true,
    });
    expect(allowed.status).toBe(201);
    const audit = await pool.query<{ count: string }>(
      `SELECT count(*) FROM "AuditLog"
       WHERE "entityId" = $1 AND action = 'guest.create_duplicate_override'`,
      [allowed.body.id],
    );
    expect(Number(audit.rows[0].count)).toBe(1);
  });

  it('returns centralized availability with room-type prices and capacity filtering', async () => {
    const staff = await token('staff');
    const availability = await api()
      .get('/api/v1/availability/rooms')
      .query({ checkInDate: '2026-09-10', checkOutDate: '2026-09-13', adults: 3 })
      .auth(staff, { type: 'bearer' });
    expect(availability.status).toBe(200);
    expect(availability.body.nights).toBe(3);
    expect(availability.body.data).toHaveLength(1);
    expect(availability.body.data[0]).toMatchObject({
      roomNumber: '201',
      nightlyRate: '200',
      estimatedRoomTotal: '600',
    });
  });

  it('snapshots automatic prices and prevents STAFF from applying discounts', async () => {
    const staff = await token('staff');
    const reservation = await createReservation(staff, [seed.room101Id]);
    expect(reservation.status).toBe(201);
    expect(reservation.body).toMatchObject({ nights: 3, subtotal: '300', estimatedTotal: '300' });
    expect(reservation.body.rooms[0].nightlyRate).toBe('100');

    await pool.query(`UPDATE "RoomType" SET "basePrice" = 150, "updatedAt" = now() WHERE id = $1`, [
      seed.standardTypeId,
    ]);
    const unchanged = await api()
      .get(`/api/v1/reservations/${String(reservation.body.id)}`)
      .auth(staff, { type: 'bearer' });
    expect(unchanged.body.rooms[0].nightlyRate).toBe('100');

    const deniedDiscount = await api()
      .patch(`/api/v1/reservations/${String(reservation.body.id)}/discount`)
      .auth(staff, { type: 'bearer' })
      .send({ amount: '20' });
    expect(deniedDiscount.status).toBe(403);

    const manager = await token('manager');
    const discounted = await api()
      .patch(`/api/v1/reservations/${String(reservation.body.id)}/discount`)
      .auth(manager, { type: 'bearer' })
      .send({ amount: '20' });
    expect(discounted.status).toBe(200);
    expect(discounted.body.estimatedTotal).toBe('280');

    await api()
      .patch(`/api/v1/reservations/${String(reservation.body.id)}/discount`)
      .auth(manager, { type: 'bearer' })
      .send({ amount: '250' });
    const invalidShortening = await api()
      .patch(`/api/v1/reservations/${String(reservation.body.id)}`)
      .auth(staff, { type: 'bearer' })
      .send({ checkOutDate: '2026-09-11' });
    expect(invalidShortening.status).toBe(409);
    expect(invalidShortening.body.code).toBe('DISCOUNT_EXCEEDS_NEW_SUBTOTAL');
  });

  it('commits exactly one of two concurrent overlapping reservation requests', async () => {
    const staff = await token('staff');
    const payload = reservationPayload(seed.guestId, [seed.room101Id], '2026-10-10', '2026-10-14');
    const attempts = await Promise.all([
      api().post('/api/v1/reservations').auth(staff, { type: 'bearer' }).send(payload),
      api().post('/api/v1/reservations').auth(staff, { type: 'bearer' }).send(payload),
    ]);
    expect(attempts.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(attempts.find((response) => response.status === 409)?.body.code).toBe(
      'ROOM_ALREADY_BOOKED',
    );

    const counts = await reservationCounts(pool);
    expect(counts).toEqual({ reservations: 1, rooms: 1, history: 1, audits: 1 });
  });

  it('rolls back every record when PostgreSQL fails after reservation creation begins', async () => {
    const staff = await token('staff');
    await pool.query(`
      CREATE OR REPLACE FUNCTION phase4_test_reject_room_102()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF EXISTS (SELECT 1 FROM "Room" WHERE id = NEW."roomId" AND "roomNumber" = '102') THEN
          RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'intentional late transaction failure';
        END IF;
        RETURN NEW;
      END;
      $$;
      CREATE TRIGGER "Phase4_test_late_failure"
      BEFORE INSERT ON "ReservationRoom"
      FOR EACH ROW EXECUTE FUNCTION phase4_test_reject_room_102();
    `);
    try {
      const failed = await createReservation(staff, [seed.room101Id, seed.room102Id]);
      expect(failed.status).toBe(409);
      expect(await reservationCounts(pool)).toEqual({
        reservations: 0,
        rooms: 0,
        history: 0,
        audits: 0,
      });
    } finally {
      await pool.query(`
        DROP TRIGGER IF EXISTS "Phase4_test_late_failure" ON "ReservationRoom";
        DROP FUNCTION IF EXISTS phase4_test_reject_room_102();
      `);
    }
  });

  it('cancellation releases the room and records controlled status history', async () => {
    const staff = await token('staff');
    const reservation = await createReservation(staff, [seed.room101Id]);
    const confirmed = await api()
      .post(`/api/v1/reservations/${String(reservation.body.id)}/confirm`)
      .auth(staff, { type: 'bearer' });
    expect(confirmed.status).toBe(201);
    expect(confirmed.body.status).toBe('CONFIRMED');

    const manager = await token('manager');
    const blockedMaintenance = await api()
      .patch(`/api/v1/rooms/${seed.room101Id}/status`)
      .auth(manager, { type: 'bearer' })
      .send({ status: 'MAINTENANCE' });
    const blockedDeactivation = await api()
      .delete(`/api/v1/rooms/${seed.room101Id}`)
      .auth(manager, { type: 'bearer' });
    expect(blockedMaintenance.status).toBe(409);
    expect(blockedMaintenance.body.code).toBe('ROOM_HAS_ACTIVE_RESERVATIONS');
    expect(blockedDeactivation.status).toBe(409);

    const cancelled = await api()
      .post(`/api/v1/reservations/${String(reservation.body.id)}/cancel`)
      .auth(staff, { type: 'bearer' })
      .send({ note: 'Guest changed travel plans' });
    expect(cancelled.status).toBe(201);
    expect(cancelled.body.status).toBe('CANCELLED');
    expect(cancelled.body.history.map((entry: { toStatus: string }) => entry.toStatus)).toEqual([
      'PENDING',
      'CONFIRMED',
      'CANCELLED',
    ]);

    const replacement = await createReservation(staff, [seed.room101Id]);
    expect(replacement.status).toBe(201);
  });

  it('rejects cross-hotel guest and room references without exposing the other tenant', async () => {
    const staff = await token('staff');
    const otherHotel = randomUUID();
    const otherGuest = randomUUID();
    await pool.query(
      `INSERT INTO "Hotel" (id, code, name, "updatedAt") VALUES ($1, 'OTHER', 'Other Hotel', now())`,
      [otherHotel],
    );
    await pool.query(
      `INSERT INTO "Guest" (id, "hotelId", "fullName", "updatedAt")
       VALUES ($1, $2, 'Other Guest', now())`,
      [otherGuest, otherHotel],
    );
    const rejectedGuest = await api()
      .post('/api/v1/reservations')
      .auth(staff, { type: 'bearer' })
      .send(reservationPayload(otherGuest, [seed.room101Id]));
    expect(rejectedGuest.status).toBe(409);
    expect(rejectedGuest.body.code).toBe('INVALID_RESERVATION_GUEST');

    const rejectedRoom = await api()
      .post('/api/v1/reservations')
      .auth(staff, { type: 'bearer' })
      .send(reservationPayload(seed.guestId, [randomUUID()]));
    expect(rejectedRoom.status).toBe(409);
    expect(rejectedRoom.body.code).toBe('INVALID_RESERVATION_ROOM');
  });

  function api() {
    return request(app.getHttpServer());
  }

  async function token(username: string): Promise<string> {
    ipSequence += 1;
    const response = await api()
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .set('X-Forwarded-For', `10.40.50.${ipSequence}`)
      .send({ identifier: username, password: 'Strong Test Password 2026!' });
    expect(response.status).toBe(201);
    return String(response.body.accessToken);
  }

  function createReservation(bearer: string, roomIds: string[]) {
    return api()
      .post('/api/v1/reservations')
      .auth(bearer, { type: 'bearer' })
      .send(reservationPayload(seed.guestId, roomIds));
  }
});

function reservationPayload(
  guestId: string,
  roomIds: string[],
  checkInDate = '2026-09-10',
  checkOutDate = '2026-09-13',
) {
  return { guestId, roomIds, checkInDate, checkOutDate, adults: 2, children: 0 };
}

async function reservationCounts(pool: Pool) {
  const result = await pool.query<{
    reservations: string;
    rooms: string;
    history: string;
    audits: string;
  }>(`
    SELECT
      (SELECT count(*) FROM "Reservation") AS reservations,
      (SELECT count(*) FROM "ReservationRoom") AS rooms,
      (SELECT count(*) FROM "ReservationHistory") AS history,
      (SELECT count(*) FROM "AuditLog" WHERE action = 'reservation.create') AS audits
  `);
  return {
    reservations: Number(result.rows[0].reservations),
    rooms: Number(result.rows[0].rooms),
    history: Number(result.rows[0].history),
    audits: Number(result.rows[0].audits),
  };
}

async function seedPhase4(pool: Pool, passwordHash: string): Promise<Seed> {
  const hotelId = randomUUID();
  await pool.query(
    `INSERT INTO "Hotel" (id, code, name, "updatedAt") VALUES ($1, 'PHASE4', 'Phase 4 Hotel', now())`,
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
      [userId, hotelId, `${username}@example.com`, username, passwordHash, `${username} user`],
    );
    await pool.query(`INSERT INTO "UserRole" ("userId", "roleId") VALUES ($1, $2)`, [
      userId,
      required(roleIds, roleName),
    ]);
  }

  const guestId = randomUUID();
  const secondGuestId = randomUUID();
  await pool.query(
    `INSERT INTO "Guest"
      (id, "hotelId", "fullName", phone, "normalizedPhone", "passportNumber", "updatedAt")
     VALUES ($1, $2, 'Primary Guest', '+252611000000', '+252611000000', 'P-100', now()),
            ($3, $2, 'Second Guest', '+252612000000', '+252612000000', 'P-200', now())`,
    [guestId, hotelId, secondGuestId],
  );

  const standardTypeId = randomUUID();
  const luxuryTypeId = randomUUID();
  await pool.query(
    `INSERT INTO "RoomType"
      (id, "hotelId", code, name, "capacityAdults", "capacityChildren", "basePrice", "updatedAt")
     VALUES ($1, $3, 'STD', 'Standard', 2, 1, 100, now()),
            ($2, $3, 'LUX', 'Luxury', 4, 2, 200, now())`,
    [standardTypeId, luxuryTypeId, hotelId],
  );
  const room101Id = randomUUID();
  const room102Id = randomUUID();
  const room201Id = randomUUID();
  await pool.query(
    `INSERT INTO "Room" (id, "hotelId", "roomTypeId", "roomNumber", "updatedAt")
     VALUES ($1, $4, $5, '101', now()),
            ($2, $4, $5, '102', now()),
            ($3, $4, $6, '201', now())`,
    [room101Id, room102Id, room201Id, hotelId, standardTypeId, luxuryTypeId],
  );
  return {
    hotelId,
    guestId,
    secondGuestId,
    standardTypeId,
    luxuryTypeId,
    room101Id,
    room102Id,
    room201Id,
  };
}

function required(map: Map<string, string>, key: string): string {
  const value = map.get(key);
  if (!value) throw new Error(`Missing mapping for ${key}`);
  return value;
}
