import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
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
  housekeepingId: string;
}
describe('Phases 6-8 finance, operations, and management', () => {
  let app: NestExpressApplication;
  let pool: Pool;
  let seed: Seed;
  let hash: string;
  let ip = 150;
  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    hash = await argon2.hash('Strong Test Password 2026!', {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication<NestExpressApplication>();
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
    seed = await seedData(pool, hash);
  });
  afterAll(async () => {
    await app.close();
    await pool.end();
  });
  it('reconciles idempotent payments, refunds, invoices, expenses, dashboard, reports, and audits', async () => {
    const staff = await token('staff'),
      manager = await token('manager');
    const method = await api()
      .post('/api/v1/payment-methods')
      .auth(manager, { type: 'bearer' })
      .send({ name: 'EVC Plus' });
    expect(method.status).toBe(201);
    const invoice = await api()
      .post(`/api/v1/reservations/${seed.reservationId}/invoice`)
      .auth(staff, { type: 'bearer' });
    expect(invoice.status).toBe(201);
    expect(invoice.body.invoice.totalAmount).toBe('200');
    const key = randomUUID();
    const payment = await api().post('/api/v1/payments').auth(staff, { type: 'bearer' }).send({
      reservationId: seed.reservationId,
      paymentMethodId: method.body.id,
      requestKey: key,
      amount: '120.00',
    });
    expect(payment.status).toBe(201);
    expect(payment.body.summary.outstandingAmount).toBe('80');
    const replay = await api().post('/api/v1/payments').auth(staff, { type: 'bearer' }).send({
      reservationId: seed.reservationId,
      paymentMethodId: method.body.id,
      requestKey: key,
      amount: '120.00',
    });
    expect(replay.body.idempotentReplay).toBe(true);
    const refund = await api()
      .post(`/api/v1/payments/${payment.body.payment.id}/refunds`)
      .auth(manager, { type: 'bearer' })
      .send({ requestKey: randomUUID(), amount: '20.00', reason: 'Partial refund approved' });
    expect(refund.status).toBe(201);
    expect(refund.body.summary.outstandingAmount).toBe('100');
    const excessive = await api()
      .post(`/api/v1/payments/${payment.body.payment.id}/refunds`)
      .auth(manager, { type: 'bearer' })
      .send({ requestKey: randomUUID(), amount: '200.00', reason: 'Too much' });
    expect(excessive.status).toBe(409);
    const category = await api()
      .post('/api/v1/expense-categories')
      .auth(manager, { type: 'bearer' })
      .send({ name: 'Fuel' });
    expect(category.status).toBe(201);
    const expense = await api().post('/api/v1/expenses').auth(staff, { type: 'bearer' }).send({
      categoryId: category.body.id,
      paymentMethodId: method.body.id,
      requestKey: randomUUID(),
      amount: '30.00',
      expenseDate: today(),
      description: 'Generator fuel',
    });
    expect(expense.status).toBe(201);
    await api()
      .post(`/api/v1/expenses/${expense.body.expense.id}/reverse`)
      .auth(staff, { type: 'bearer' })
      .send({ reason: 'Mistake' })
      .expect(403);
    await api()
      .post(`/api/v1/expenses/${expense.body.expense.id}/reverse`)
      .auth(manager, { type: 'bearer' })
      .send({ reason: 'Duplicate receipt' })
      .expect(201);
    const dashboard = await api()
      .get('/api/v1/dashboard/summary')
      .auth(manager, { type: 'bearer' });
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.financial).toMatchObject({
      revenue: '100.00',
      expenses: '0',
      outstanding: '100.00',
    });
    const report = await api()
      .get('/api/v1/reports/revenue')
      .query({ from: today(), to: addDays(today(), 1) })
      .auth(manager, { type: 'bearer' });
    expect(report.status).toBe(200);
    expect(report.body.data[0].revenue).toBe('100.00');
    const audits = await api().get('/api/v1/audit-logs').auth(manager, { type: 'bearer' });
    expect(audits.status).toBe(200);
    expect(audits.body.pagination.total).toBeGreaterThanOrEqual(7);
    const competing = await Promise.all([
      api()
        .post(`/api/v1/payments/${payment.body.payment.id}/refunds`)
        .auth(manager, { type: 'bearer' })
        .send({ requestKey: randomUUID(), amount: '80.00', reason: 'Concurrent refund A' }),
      api()
        .post(`/api/v1/payments/${payment.body.payment.id}/refunds`)
        .auth(manager, { type: 'bearer' })
        .send({ requestKey: randomUUID(), amount: '80.00', reason: 'Concurrent refund B' }),
    ]);
    expect(competing.map((response) => response.status).sort()).toEqual([201, 409]);
    await expect(
      pool.query(`UPDATE "Payment" SET amount = 1 WHERE id = $1`, [payment.body.payment.id]),
    ).rejects.toThrow(/immutable/i);
  });
  it('moves a dirty room through cleaning and then safe maintenance', async () => {
    const staff = await token('staff'),
      manager = await token('manager');
    const tasks = await api().get('/api/v1/housekeeping/tasks').auth(staff, { type: 'bearer' });
    expect(tasks.body).toHaveLength(1);
    await api()
      .post(`/api/v1/housekeeping/tasks/${seed.housekeepingId}/start`)
      .auth(staff, { type: 'bearer' })
      .expect(201);
    await api()
      .post(`/api/v1/housekeeping/tasks/${seed.housekeepingId}/complete`)
      .auth(staff, { type: 'bearer' })
      .expect(201);
    const maintenance = await api()
      .post('/api/v1/maintenance/requests')
      .auth(staff, { type: 'bearer' })
      .send({ roomId: seed.roomId, problem: 'Air conditioner not cooling' });
    expect(maintenance.status).toBe(201);
    await api()
      .post(`/api/v1/maintenance/requests/${maintenance.body.id}/start`)
      .auth(staff, { type: 'bearer' })
      .expect(403);
    await api()
      .post(`/api/v1/maintenance/requests/${maintenance.body.id}/start`)
      .auth(manager, { type: 'bearer' })
      .expect(201);
    await api()
      .post(`/api/v1/maintenance/requests/${maintenance.body.id}/complete`)
      .auth(manager, { type: 'bearer' })
      .send({ cost: '15.00', notes: 'Replaced capacitor' })
      .expect(201);
    const room = await pool.query<{ status: string }>('SELECT status FROM "Room" WHERE id=$1', [
      seed.roomId,
    ]);
    expect(room.rows[0].status).toBe('AVAILABLE');
  });
  function api() {
    return request(app.getHttpServer());
  }
  async function token(username: string) {
    ip++;
    const res = await api()
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .set('X-Forwarded-For', `10.60.70.${ip}`)
      .send({ identifier: username, password: 'Strong Test Password 2026!' });
    expect(res.status).toBe(201);
    return String(res.body.accessToken);
  }
});
async function seedData(pool: Pool, hash: string): Promise<Seed> {
  const hotelId = randomUUID();
  await pool.query(
    `INSERT INTO "Hotel"(id,code,name,timezone,"updatedAt") VALUES($1,'PHASE678','Management Hotel','Europe/Moscow',now())`,
    [hotelId],
  );
  const perms = new Map<string, string>();
  for (const key of ALL_PERMISSIONS) {
    const id = randomUUID();
    perms.set(key, id);
    await pool.query('INSERT INTO "Permission"(id,key)VALUES($1,$2)', [id, key]);
  }
  const roles = new Map<string, string>();
  for (const name of Object.values(SYSTEM_ROLES)) {
    const id = randomUUID();
    roles.set(name, id);
    await pool.query(
      'INSERT INTO "Role"(id,"hotelId",name,"isSystem","updatedAt")VALUES($1,$2,$3,true,now())',
      [id, hotelId, name],
    );
    for (const p of ROLE_PERMISSION_MATRIX[name])
      await pool.query('INSERT INTO "RolePermission"("roleId","permissionId")VALUES($1,$2)', [
        id,
        req(perms, p),
      ]);
  }
  for (const [username, role] of [
    ['manager', SYSTEM_ROLES.MANAGER],
    ['staff', SYSTEM_ROLES.STAFF],
  ] as const) {
    const id = randomUUID();
    await pool.query(
      'INSERT INTO "User"(id,"hotelId",email,username,"passwordHash","fullName","updatedAt")VALUES($1,$2,$3,$4,$5,$6,now())',
      [id, hotelId, `${username}@phase678.test`, username, hash, `${username} user`],
    );
    await pool.query('INSERT INTO "UserRole"("userId","roleId")VALUES($1,$2)', [
      id,
      req(roles, role),
    ]);
  }
  const guest = randomUUID(),
    type = randomUUID(),
    roomId = randomUUID(),
    reservationId = randomUUID(),
    rr = randomUUID(),
    charge = randomUUID(),
    housekeepingId = randomUUID();
  const start = today(),
    end = addDays(start, 2);
  await pool.query(
    'INSERT INTO "Guest"(id,"hotelId","fullName","updatedAt")VALUES($1,$2,$3,now())',
    [guest, hotelId, 'Finance Guest'],
  );
  await pool.query(
    'INSERT INTO "RoomType"(id,"hotelId",code,name,"capacityAdults","capacityChildren","basePrice","updatedAt")VALUES($1,$2,$3,$4,2,1,100,now())',
    [type, hotelId, 'STD', 'Standard'],
  );
  await pool.query(
    'INSERT INTO "Room"(id,"hotelId","roomTypeId","roomNumber",status,"updatedAt")VALUES($1,$2,$3,$4,$5,now())',
    [roomId, hotelId, type, '101', 'OCCUPIED'],
  );
  await pool.query(
    `INSERT INTO "Reservation"(id,"hotelId","guestId","bookingNumber",status,"checkInDate","checkOutDate",adults,children,"checkedInAt","updatedAt")VALUES($1,$2,$3,'RSV-260817-FIN001','CHECKED_IN',$4::date,$5::date,1,0,now(),now())`,
    [reservationId, hotelId, guest, start, end],
  );
  await pool.query(
    `INSERT INTO "ReservationRoom"(id,"reservationId","roomId","checkInDate","checkOutDate","nightlyRate","bookingStatus","updatedAt")VALUES($1,$2,$3,$4::date,$5::date,100,'CHECKED_IN',now())`,
    [rr, reservationId, roomId, start, end],
  );
  await pool.query(
    `INSERT INTO "Charge"(id,"reservationId","reservationRoomId",type,description,quantity,"unitPrice","totalAmount")VALUES($1,$2,$3,'ROOM','Room 101 — 2 nights',2,100,200)`,
    [charge, reservationId, rr],
  );
  await pool.query(
    `UPDATE "Reservation" SET status='CHECKED_OUT',"checkedOutAt"=now() WHERE id=$1`,
    [reservationId],
  );
  await pool.query(`UPDATE "Room" SET status='DIRTY' WHERE id=$1`, [roomId]);
  await pool.query(
    `INSERT INTO "HousekeepingTask"(id,"hotelId","roomId","reservationId",notes,"updatedAt")VALUES($1,$2,$3,$4,'Checkout cleaning',now())`,
    [housekeepingId, hotelId, roomId, reservationId],
  );
  return { hotelId, reservationId, roomId, housekeepingId };
}
function req(m: Map<string, string>, k: string) {
  const v = m.get(k);
  if (!v) throw new Error(k);
  return v;
}
function today() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
function addDays(v: string, n: number) {
  const d = new Date(`${v}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
