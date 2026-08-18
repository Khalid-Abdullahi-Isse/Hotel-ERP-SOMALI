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
  userIds: Record<string, string>;
}

describe('Phase 3 hotel inventory', () => {
  let app: NestExpressApplication;
  let pool: Pool;
  let seed: Seed;
  let passwordHash: string;
  let loginSequence = 30;

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
    seed = await seedHotel(pool, passwordHash);
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it('inherits Standard and Luxury prices while STAFF has read-only room access', async () => {
    const manager = await token('manager');
    const floor = await api()
      .post('/api/v1/floors')
      .auth(manager, { type: 'bearer' })
      .send({ number: 1, name: 'First Floor' });
    expect(floor.status).toBe(201);

    const standard = await createRoomType(manager, 'STD', 'Standard', '100.00');
    const luxury = await createRoomType(manager, 'LUX', 'Luxury', '200.00');
    await createRoom(manager, '101', standard.body.id, floor.body.id);
    await createRoom(manager, '201', luxury.body.id, floor.body.id);

    const staff = await token('staff');
    const rooms = await api().get('/api/v1/rooms').auth(staff, { type: 'bearer' });
    expect(rooms.status).toBe(200);
    expect(rooms.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ roomNumber: '101', effectivePrice: '100' }),
        expect.objectContaining({ roomNumber: '201', effectivePrice: '200' }),
      ]),
    );

    const forbiddenPriceConfiguration = await api()
      .post('/api/v1/room-types')
      .auth(staff, { type: 'bearer' })
      .send(roomTypePayload('SUITE', 'Suite', '300'));
    expect(forbiddenPriceConfiguration.status).toBe(403);
  });

  it('lets MANAGER update hotel settings but denies STAFF configuration access', async () => {
    const manager = await token('manager');
    const updated = await api()
      .patch('/api/v1/hotels/current')
      .auth(manager, { type: 'bearer' })
      .send({ name: 'Updated Hotel', currencyCode: 'usd', timezone: 'Africa/Mogadishu' });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ name: 'Updated Hotel', currencyCode: 'USD' });

    const staff = await token('staff');
    const denied = await api().get('/api/v1/hotels/current').auth(staff, { type: 'bearer' });
    expect(denied.status).toBe(403);
  });

  it('updates price only through the room type and audits the old and new price', async () => {
    const manager = await token('manager');
    const standard = await createRoomType(manager, 'STD', 'Standard', '100');
    const room = await createRoom(manager, '101', standard.body.id);

    const manualOverride = await api()
      .patch(`/api/v1/rooms/${String(room.body.id)}`)
      .auth(manager, { type: 'bearer' })
      .send({ priceOverride: '1.00' });
    expect(manualOverride.status).toBe(400);

    const priceUpdate = await api()
      .patch(`/api/v1/room-types/${String(standard.body.id)}`)
      .auth(manager, { type: 'bearer' })
      .send({ basePrice: '125.50' });
    expect(priceUpdate.status).toBe(200);
    expect(priceUpdate.body.basePrice).toBe('125.5');

    const refreshedRoom = await api()
      .get(`/api/v1/rooms/${String(room.body.id)}`)
      .auth(manager, { type: 'bearer' });
    expect(refreshedRoom.body.effectivePrice).toBe('125.5');

    const audit = await pool.query<{
      action: string;
      oldValue: { basePrice: string };
      newValue: { basePrice: string };
    }>(
      `SELECT action, "oldValue", "newValue" FROM "AuditLog"
       WHERE "entityId" = $1 AND action = 'room_type.price_update'`,
      [standard.body.id],
    );
    expect(audit.rows[0]).toMatchObject({
      action: 'room_type.price_update',
      oldValue: { basePrice: '100' },
      newValue: { basePrice: '125.5' },
    });
  });

  it('rejects cross-hotel references in both the API and PostgreSQL', async () => {
    const manager = await token('manager');
    const standard = await createRoomType(manager, 'STD', 'Standard', '100');
    const secondHotelId = randomUUID();
    const secondFloorId = randomUUID();
    await pool.query(
      `INSERT INTO "Hotel" (id, code, name, "updatedAt") VALUES ($1, 'SECOND', 'Second Hotel', now())`,
      [secondHotelId],
    );
    await pool.query(
      `INSERT INTO "Floor" (id, "hotelId", number, "updatedAt") VALUES ($1, $2, 1, now())`,
      [secondFloorId, secondHotelId],
    );

    const rejected = await createRoom(manager, '101', standard.body.id, secondFloorId);
    expect(rejected.status).toBe(409);
    expect(rejected.body.code).toBe('INVALID_FLOOR');

    await expect(
      pool.query(
        `INSERT INTO "Room" (id, "hotelId", "floorId", "roomTypeId", "roomNumber", "updatedAt")
         VALUES ($1, $2, $3, $4, '102', now())`,
        [randomUUID(), seed.hotelId, secondFloorId, standard.body.id],
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('allows only one concurrent room creation for a canonical room number', async () => {
    const manager = await token('manager');
    const standard = await createRoomType(manager, 'STD', 'Standard', '100');
    const attempts = await Promise.all([
      createRoom(manager, 'A-101', standard.body.id),
      createRoom(manager, ' a-101 ', standard.body.id),
    ]);
    expect(attempts.map((response) => response.status).sort()).toEqual([201, 409]);
  });

  it('protects populated floors and active room types, then permits safe cleanup', async () => {
    const manager = await token('manager');
    const floor = await api()
      .post('/api/v1/floors')
      .auth(manager, { type: 'bearer' })
      .send({ number: 1 });
    const standard = await createRoomType(manager, 'STD', 'Standard', '100');
    const room = await createRoom(manager, '101', standard.body.id, floor.body.id);

    const floorBlocked = await api()
      .delete(`/api/v1/floors/${String(floor.body.id)}`)
      .auth(manager, { type: 'bearer' });
    expect(floorBlocked.status).toBe(409);
    expect(floorBlocked.body.code).toBe('FLOOR_NOT_EMPTY');

    const typeBlocked = await api()
      .delete(`/api/v1/room-types/${String(standard.body.id)}`)
      .auth(manager, { type: 'bearer' });
    expect(typeBlocked.status).toBe(409);

    await api()
      .patch(`/api/v1/rooms/${String(room.body.id)}`)
      .auth(manager, { type: 'bearer' })
      .send({ floorId: null });
    await api()
      .delete(`/api/v1/rooms/${String(room.body.id)}`)
      .auth(manager, { type: 'bearer' });

    const floorDeleted = await api()
      .delete(`/api/v1/floors/${String(floor.body.id)}`)
      .auth(manager, { type: 'bearer' });
    const typeDeactivated = await api()
      .delete(`/api/v1/room-types/${String(standard.body.id)}`)
      .auth(manager, { type: 'bearer' });
    expect(floorDeleted.status).toBe(200);
    expect(typeDeactivated.status).toBe(200);
    expect(typeDeactivated.body.isActive).toBe(false);
  });

  it('allows only Phase 3 maintenance status transitions', async () => {
    const manager = await token('manager');
    const standard = await createRoomType(manager, 'STD', 'Standard', '100');
    const room = await createRoom(manager, '101', standard.body.id);

    const maintenance = await api()
      .patch(`/api/v1/rooms/${String(room.body.id)}/status`)
      .auth(manager, { type: 'bearer' })
      .send({ status: 'MAINTENANCE' });
    expect(maintenance.status).toBe(200);
    expect(maintenance.body.status).toBe('MAINTENANCE');

    const occupied = await api()
      .patch(`/api/v1/rooms/${String(room.body.id)}/status`)
      .auth(manager, { type: 'bearer' })
      .send({ status: 'OCCUPIED' });
    expect(occupied.status).toBe(400);

    await pool.query(`UPDATE "Room" SET status = 'DIRTY', "updatedAt" = now() WHERE id = $1`, [
      room.body.id,
    ]);
    const workflowOwned = await api()
      .patch(`/api/v1/rooms/${String(room.body.id)}/status`)
      .auth(manager, { type: 'bearer' })
      .send({ status: 'AVAILABLE' });
    expect(workflowOwned.status).toBe(409);
    expect(workflowOwned.body.code).toBe('ROOM_STATUS_MANAGED_BY_WORKFLOW');
  });

  function api() {
    return request(app.getHttpServer());
  }

  async function token(username: string): Promise<string> {
    loginSequence += 1;
    const response = await api()
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .set('X-Forwarded-For', `10.30.40.${loginSequence}`)
      .send({ identifier: username, password: 'Strong Test Password 2026!' });
    expect(response.status).toBe(201);
    return String(response.body.accessToken);
  }

  function createRoomType(bearer: string, code: string, name: string, basePrice: string) {
    return api()
      .post('/api/v1/room-types')
      .auth(bearer, { type: 'bearer' })
      .send(roomTypePayload(code, name, basePrice));
  }

  function createRoom(bearer: string, roomNumber: string, roomTypeId: string, floorId?: string) {
    return api()
      .post('/api/v1/rooms')
      .auth(bearer, { type: 'bearer' })
      .send({ roomNumber, roomTypeId, ...(floorId ? { floorId } : {}) });
  }
});

function roomTypePayload(code: string, name: string, basePrice: string) {
  return { code, name, capacityAdults: 2, capacityChildren: 1, basePrice };
}

async function seedHotel(pool: Pool, passwordHash: string): Promise<Seed> {
  const hotelId = randomUUID();
  await pool.query(
    `INSERT INTO "Hotel" (id, code, name, "updatedAt")
     VALUES ($1, 'PHASE3', 'Phase 3 Hotel', now())`,
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

  const userIds: Record<string, string> = {};
  for (const [username, roleName] of [
    ['admin', SYSTEM_ROLES.ADMIN],
    ['manager', SYSTEM_ROLES.MANAGER],
    ['staff', SYSTEM_ROLES.STAFF],
  ] as const) {
    const userId = randomUUID();
    userIds[username] = userId;
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
  return { hotelId, userIds };
}

function required(map: Map<string, string>, key: string): string {
  const value = map.get(key);
  if (!value) throw new Error(`Missing mapping for ${key}`);
  return value;
}
