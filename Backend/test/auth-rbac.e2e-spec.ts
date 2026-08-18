import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { Pool } from 'pg';
import request, { type Response as SupertestResponse } from 'supertest';
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
  adminRoleId: string;
  managerRoleId: string;
  staffRoleId: string;
}

describe('Authentication and RBAC', () => {
  let app: NestExpressApplication;
  let pool: Pool;
  let seed: Seed;
  let passwordHash: string;
  let loginSequence = 10;

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
    seed = await seedSecurityData(pool, passwordHash);
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it('logs in without exposing the refresh token and creates a seven-day session', async () => {
    const response = await login('admin');

    expect(response.status).toBe(201);
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.expiresIn).toBe(900);
    expect(response.body.refreshToken).toBeUndefined();
    expect(response.body.user.roles).toContain(SYSTEM_ROLES.ADMIN);
    expect(refreshCookie(response)).toContain('HttpOnly');

    const session = await pool.query<{ remaining_days: string }>(
      `SELECT extract(epoch FROM ("expiresAt" - now())) / 86400 AS remaining_days
       FROM "AuthSession" WHERE "userId" = $1`,
      [seed.adminId],
    );
    expect(Number(session.rows[0].remaining_days)).toBeGreaterThan(6.9);
    expect(Number(session.rows[0].remaining_days)).toBeLessThanOrEqual(7.01);
  });

  it('returns the same generic error for incorrect and unknown credentials', async () => {
    const incorrect = await login('admin', 'Wrong Password 2026!');
    const unknown = await login('does-not-exist', 'Wrong Password 2026!');

    expect(incorrect.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(incorrect.body.message).toBe(unknown.body.message);
  });

  it('rotates refresh tokens and revokes the session when an old token is replayed', async () => {
    const authenticated = await login('admin');
    const firstCookie = refreshCookie(authenticated).split(';')[0];
    const rotated = await api()
      .post('/api/v1/auth/refresh')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', firstCookie);
    expect(rotated.status).toBe(201);
    const secondCookie = refreshCookie(rotated).split(';')[0];
    expect(secondCookie).not.toBe(firstCookie);

    const replay = await api()
      .post('/api/v1/auth/refresh')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', firstCookie);
    expect(replay.status).toBe(401);

    const familyRevoked = await api()
      .post('/api/v1/auth/refresh')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', secondCookie);
    expect(familyRevoked.status).toBe(401);
  });

  it('denies combined STAFF and MANAGER access to ADMIN-only administration', async () => {
    const staff = await login('staff');
    const staffResponse = await api()
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${String(staff.body.accessToken)}`);
    const manager = await login('manager');
    const managerResponse = await api()
      .get('/api/v1/roles')
      .set('Authorization', `Bearer ${String(manager.body.accessToken)}`);

    expect(staffResponse.status).toBe(403);
    expect(staffResponse.body.code).toBe('ADMIN_REQUIRED');
    expect(managerResponse.status).toBe(403);
    expect(managerResponse.body.code).toBe('ADMIN_REQUIRED');
  });

  it('locks an account after five failed logins and keeps the error generic', async () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await login('staff', 'Wrong Password 2026!');
      expect(response.status).toBe(401);
      expect(response.body.message).toBe('The username or password is incorrect.');
    }
    const stored = await pool.query<{
      status: string;
      failedLoginAttempts: number;
      lockedUntil: Date;
    }>(`SELECT status, "failedLoginAttempts", "lockedUntil" FROM "User" WHERE username = 'staff'`);
    expect(stored.rows[0].status).toBe('LOCKED');
    expect(stored.rows[0].failedLoginAttempts).toBe(5);
    expect(stored.rows[0].lockedUntil).toBeInstanceOf(Date);

    const correctPassword = await login('staff');
    expect(correctPassword.status).toBe(401);
    expect(correctPassword.body.message).toBe('The username or password is incorrect.');
  });

  it('lets ADMIN create and deactivate a user, revoking that user session', async () => {
    const admin = await login('admin');
    const adminToken = String(admin.body.accessToken);
    const created = await api()
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'new.staff@example.com',
        username: 'new.staff',
        fullName: 'New Staff Member',
        password: 'New Staff Password 2026!',
        roleIds: [seed.staffRoleId],
      });
    expect(created.status).toBe(201);
    expect(created.body.passwordHash).toBeUndefined();
    const sensitiveAudit = await pool.query<{ count: string }>(
      `SELECT count(*) FROM "AuditLog"
       WHERE (coalesce("oldValue"::text, '') || coalesce("newValue"::text, ''))
       ILIKE '%New Staff Password 2026!%'`,
    );
    expect(Number(sensitiveAudit.rows[0].count)).toBe(0);

    const newStaff = await login('new.staff', 'New Staff Password 2026!');
    expect(newStaff.status).toBe(201);
    const deleted = await api()
      .delete(`/api/v1/users/${String(created.body.id)}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleted.status).toBe(200);
    expect(deleted.body.status).toBe('INACTIVE');

    const rejected = await api()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${String(newStaff.body.accessToken)}`);
    expect(rejected.status).toBe(401);
  });

  it('allows only one of two concurrent duplicate user creations', async () => {
    const admin = await login('admin');
    const payload = {
      email: 'duplicate@example.com',
      username: 'duplicate.user',
      fullName: 'Duplicate User',
      password: 'Duplicate Password 2026!',
      roleIds: [seed.staffRoleId],
    };
    const attempts = await Promise.all([
      api()
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${String(admin.body.accessToken)}`)
        .send(payload),
      api()
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${String(admin.body.accessToken)}`)
        .send(payload),
    ]);
    expect(attempts.map((response) => response.status).sort()).toEqual([201, 409]);
  });

  it('allows ADMIN custom-role management but protects system roles and the last ADMIN', async () => {
    const admin = await login('admin');
    const token = String(admin.body.accessToken);
    const created = await api()
      .post('/api/v1/roles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'NIGHT SUPERVISOR',
        description: 'Night shift reporting role',
        permissionKeys: ['reservation.view', 'report.view'],
      });
    expect(created.status).toBe(201);

    const deletedCustom = await api()
      .delete(`/api/v1/roles/${String(created.body.id)}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deletedCustom.status).toBe(200);
    expect(deletedCustom.body.isActive).toBe(false);

    const deleteSystem = await api()
      .delete(`/api/v1/roles/${seed.staffRoleId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteSystem.status).toBe(409);

    const deleteLastAdmin = await api()
      .delete(`/api/v1/users/${seed.adminId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteLastAdmin.status).toBe(409);
    expect(deleteLastAdmin.body.code).toBe('LAST_ADMIN_REQUIRED');
  });

  it('rejects cross-hotel role assignment at PostgreSQL level', async () => {
    const secondHotelId = randomUUID();
    const secondUserId = randomUUID();
    await pool.query(
      `INSERT INTO "Hotel" (id, code, name, "updatedAt") VALUES ($1, 'HARGEISA', 'Second Hotel', now())`,
      [secondHotelId],
    );
    await pool.query(
      `INSERT INTO "User"
        (id, "hotelId", email, username, "passwordHash", "fullName", "updatedAt")
       VALUES ($1, $2, 'second@example.com', 'second', $3, 'Second User', now())`,
      [secondUserId, secondHotelId, passwordHash],
    );
    await expect(
      pool.query(`INSERT INTO "UserRole" ("userId", "roleId") VALUES ($1, $2)`, [
        secondUserId,
        seed.staffRoleId,
      ]),
    ).rejects.toMatchObject({ code: '23514' });
  });

  function api() {
    return request(app.getHttpServer());
  }

  function login(identifier: string, password = 'Strong Test Password 2026!') {
    loginSequence += 1;
    return api()
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .set('X-Forwarded-For', `10.20.30.${loginSequence}`)
      .send({ identifier, password });
  }
});

function refreshCookie(response: SupertestResponse): string {
  const header = response.headers['set-cookie'];
  const cookie = Array.isArray(header) ? header[0] : header;
  if (!cookie) throw new Error('Expected a refresh cookie.');
  return cookie;
}

async function seedSecurityData(pool: Pool, passwordHash: string): Promise<Seed> {
  const hotelId = randomUUID();
  await pool.query(
    `INSERT INTO "Hotel" (id, code, name, "updatedAt") VALUES ($1, 'MOG-AUTH', 'Auth Test Hotel', now())`,
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
    pool,
    hotelId,
    'admin',
    passwordHash,
    requiredMapValue(roleIds, SYSTEM_ROLES.ADMIN),
  );
  await insertUser(
    pool,
    hotelId,
    'manager',
    passwordHash,
    requiredMapValue(roleIds, SYSTEM_ROLES.MANAGER),
  );
  await insertUser(
    pool,
    hotelId,
    'staff',
    passwordHash,
    requiredMapValue(roleIds, SYSTEM_ROLES.STAFF),
  );
  return {
    hotelId,
    adminId,
    adminRoleId: requiredMapValue(roleIds, SYSTEM_ROLES.ADMIN),
    managerRoleId: requiredMapValue(roleIds, SYSTEM_ROLES.MANAGER),
    staffRoleId: requiredMapValue(roleIds, SYSTEM_ROLES.STAFF),
  };
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

function requiredMapValue(map: Map<string, string>, key: string): string {
  const value = map.get(key);
  if (!value) throw new Error(`Missing test mapping for ${key}`);
  return value;
}
