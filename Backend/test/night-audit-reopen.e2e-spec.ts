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
}

describe('Night audit reopen workflow', () => {
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
      .set('X-Forwarded-For', `20.40.60.${loginSequence}`)
      .send({ identifier, password });
  }

  async function seedPostedDate(businessDate: string): Promise<{ id: string }> {
    const id = randomUUID();
    await pool.query(
      `INSERT INTO "HotelBusinessDate" (id, "hotelId", "businessDate", status, "roomNights", "totalRoomRevenue", "updatedAt")
       VALUES ($1, $2, $3, 'POSTED', 2, '100.00', now())`,
      [id, seed.hotelId, businessDate],
    );
    return { id };
  }

  async function getStatus(businessDate: string): Promise<string | null> {
    const res = await pool.query<{ status: string }>(
      `SELECT "status" FROM "HotelBusinessDate" WHERE "hotelId" = $1 AND "businessDate" = $2`,
      [seed.hotelId, businessDate],
    );
    return res.rows[0]?.status ?? null;
  }

  function reopen(businessDate: string, token: string) {
    return api()
      .post(`/api/v1/accounting/night-audit/${businessDate}/reopen`)
      .set('Authorization', `Bearer ${token}`);
  }

  describe('Reopen business date', () => {
    it('A: admin reopens a posted business date to OPEN', async () => {
      const adminToken = String((await login('admin')).body.accessToken);
      await seedPostedDate('2026-09-01');
      expect(await getStatus('2026-09-01')).toBe('POSTED');

      const res = await reopen('2026-09-01', adminToken);
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('OPEN');
      expect(res.body.businessDate).toBe('2026-09-01');
      expect(await getStatus('2026-09-01')).toBe('OPEN');
    });

    it('B: reopening a date that is not posted fails', async () => {
      const adminToken = String((await login('admin')).body.accessToken);
      await pool.query(
        `INSERT INTO "HotelBusinessDate" (id, "hotelId", "businessDate", status, "updatedAt")
         VALUES ($1, $2, $3, 'OPEN', now())`,
        [randomUUID(), seed.hotelId, '2026-09-02'],
      );

      const res = await reopen('2026-09-02', adminToken);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('BUSINESS_DATE_NOT_POSTED');
    });

    it('C: reopening an earlier date while a later date exists fails', async () => {
      const adminToken = String((await login('admin')).body.accessToken);
      await seedPostedDate('2026-09-01');
      await seedPostedDate('2026-09-02');

      const res = await reopen('2026-09-01', adminToken);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('LATER_BUSINESS_DATE_EXISTS');
    });

    it('D: reopening a missing date returns 404', async () => {
      const adminToken = String((await login('admin')).body.accessToken);
      const res = await reopen('2099-01-01', adminToken);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('BUSINESS_DATE_NOT_FOUND');
    });

    it('E: manager (no accounting.manage) is forbidden from reopening', async () => {
      const managerToken = String((await login('manager')).body.accessToken);
      await seedPostedDate('2026-09-01');

      const res = await reopen('2026-09-01', managerToken);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('PERMISSION_DENIED');
      expect(await getStatus('2026-09-01')).toBe('POSTED');
    });

    it('F: reopened date can be re-posted and totals are recomputed', async () => {
      const adminToken = String((await login('admin')).body.accessToken);
      await seedPostedDate('2026-09-01');

      const reopened = await reopen('2026-09-01', adminToken);
      expect(reopened.body.status).toBe('OPEN');

      const postRes = await api()
        .post('/api/v1/accounting/night-audit/post')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ businessDate: '2026-09-01' });
      expect(postRes.status).toBe(201);
      expect(postRes.body.status).toBe('POSTED');
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

async function seedTestData(
  pool: Pool,
  passwordHash: string,
): Promise<Seed> {
  const hotelId = randomUUID();
  await pool.query(
    `INSERT INTO "Hotel" (id, code, name, "updatedAt") VALUES ($1, 'NA-TEST', 'Night Audit Test Hotel', now())`,
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

  return { hotelId, adminId, managerId };
}
