import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

interface SeedData {
  hotelId: string;
  roomId: string;
  guestId: string;
}

describe('PostgreSQL business integrity', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let seed: SeedData;

  beforeEach(async () => {
    await pool.query('TRUNCATE TABLE "Hotel" CASCADE');
    seed = await seedBaseData(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('rejects duplicate room numbers inside one hotel', async () => {
    const roomType = await pool.query<{ id: string }>(
      'SELECT "roomTypeId" AS id FROM "Room" WHERE id = $1',
      [seed.roomId],
    );

    await expect(
      pool.query(
        `INSERT INTO "Room" (id, "hotelId", "roomTypeId", "roomNumber", "updatedAt")
         VALUES ($1, $2, $3, '101', now())`,
        [randomUUID(), seed.hotelId, roomType.rows[0].id],
      ),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('rejects an invalid reservation date range', async () => {
    await expect(
      insertReservation(pool, seed, 'INVALID-DATES', '2026-08-25', '2026-08-20'),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('rejects duplicate passport numbers case-insensitively within a hotel', async () => {
    await pool.query('UPDATE "Guest" SET "passportNumber" = $1 WHERE id = $2', [
      'P-12345',
      seed.guestId,
    ]);

    await expect(
      pool.query(
        `INSERT INTO "Guest" (id, "hotelId", "fullName", "passportNumber", "updatedAt")
         VALUES ($1, $2, 'Second Guest', ' p-12345 ', now())`,
        [randomUUID(), seed.hotelId],
      ),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('allows exactly one of two concurrent overlapping room reservations', async () => {
    const firstReservation = await insertReservation(
      pool,
      seed,
      'CONCURRENT-A',
      '2026-08-20',
      '2026-08-25',
    );
    const secondReservation = await insertReservation(
      pool,
      seed,
      'CONCURRENT-B',
      '2026-08-23',
      '2026-08-27',
    );

    const attempts = await Promise.allSettled([
      insertReservationRoom(pool, firstReservation, seed.roomId),
      insertReservationRoom(pool, secondReservation, seed.roomId),
    ]);
    const successes = attempts.filter((result) => result.status === 'fulfilled');
    const failures = attempts.filter((result) => result.status === 'rejected');

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(errorCode(failures[0].reason)).toBe('23P01');

    const stored = await pool.query<{ count: string }>(
      'SELECT count(*) FROM "ReservationRoom" WHERE "roomId" = $1',
      [seed.roomId],
    );
    expect(Number(stored.rows[0].count)).toBe(1);
  });

  it('allows back-to-back stays because checkout is an exclusive boundary', async () => {
    const first = await insertReservation(pool, seed, 'ADJACENT-A', '2026-09-01', '2026-09-03');
    const second = await insertReservation(pool, seed, 'ADJACENT-B', '2026-09-03', '2026-09-05');

    await insertReservationRoom(pool, first, seed.roomId);
    await insertReservationRoom(pool, second, seed.roomId);

    const stored = await pool.query<{ count: string }>(
      'SELECT count(*) FROM "ReservationRoom" WHERE "roomId" = $1',
      [seed.roomId],
    );
    expect(Number(stored.rows[0].count)).toBe(2);
  });

  it('rejects direct maintenance or deactivation of a room with an active booking', async () => {
    const reservation = await insertReservation(
      pool,
      seed,
      'ROOM-PROTECTION',
      '2026-10-01',
      '2026-10-03',
    );
    await insertReservationRoom(pool, reservation, seed.roomId);

    await expect(
      pool.query(`UPDATE "Room" SET status = 'MAINTENANCE', "updatedAt" = now() WHERE id = $1`, [
        seed.roomId,
      ]),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      pool.query(`UPDATE "Room" SET "isActive" = false, "updatedAt" = now() WHERE id = $1`, [
        seed.roomId,
      ]),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('makes audit logs append-only', async () => {
    const auditId = randomUUID();
    await pool.query(
      `INSERT INTO "AuditLog" (id, "hotelId", action, "entityType", "entityId")
       VALUES ($1, $2, 'room.create', 'Room', $3)`,
      [auditId, seed.hotelId, seed.roomId],
    );

    await expect(
      pool.query('UPDATE "AuditLog" SET action = $1 WHERE id = $2', ['tampered', auditId]),
    ).rejects.toMatchObject({ code: '55000' });
  });
});

async function seedBaseData(pool: Pool): Promise<SeedData> {
  const hotelId = randomUUID();
  const roomTypeId = randomUUID();
  const roomId = randomUUID();
  const guestId = randomUUID();

  await pool.query(
    `INSERT INTO "Hotel" (id, code, name, "updatedAt") VALUES ($1, 'MOG-TEST', 'Test Hotel', now())`,
    [hotelId],
  );
  await pool.query(
    `INSERT INTO "RoomType"
      (id, "hotelId", code, name, "capacityAdults", "basePrice", "updatedAt")
     VALUES ($1, $2, 'STD', 'Standard', 2, 30, now())`,
    [roomTypeId, hotelId],
  );
  await pool.query(
    `INSERT INTO "Room" (id, "hotelId", "roomTypeId", "roomNumber", "updatedAt")
     VALUES ($1, $2, $3, '101', now())`,
    [roomId, hotelId, roomTypeId],
  );
  await pool.query(
    `INSERT INTO "Guest" (id, "hotelId", "fullName", "normalizedPhone", "updatedAt")
     VALUES ($1, $2, 'Test Guest', '+252611000000', now())`,
    [guestId, hotelId],
  );
  return { hotelId, roomId, guestId };
}

async function insertReservation(
  pool: Pool,
  seed: SeedData,
  bookingNumber: string,
  checkIn: string,
  checkOut: string,
): Promise<string> {
  const id = randomUUID();
  const token = bookingNumber
    .replace(/[^A-Z0-9]/gi, '')
    .toUpperCase()
    .slice(-6)
    .padStart(6, '0');
  await pool.query(
    `INSERT INTO "Reservation"
      (id, "hotelId", "guestId", "bookingNumber", "checkInDate", "checkOutDate", "updatedAt")
     VALUES ($1, $2, $3, $4, $5::date, $6::date, now())`,
    [id, seed.hotelId, seed.guestId, `RSV-260817-${token}`, checkIn, checkOut],
  );
  return id;
}

async function insertReservationRoom(
  pool: Pool,
  reservationId: string,
  roomId: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO "ReservationRoom"
      (id, "reservationId", "roomId", "checkInDate", "checkOutDate", "nightlyRate", "updatedAt")
     VALUES ($1, $2, $3, DATE '2000-01-01', DATE '2000-01-02', 30, now())`,
    [randomUUID(), reservationId, roomId],
  );
}

function errorCode(value: unknown): string | undefined {
  if (typeof value === 'object' && value !== null && 'code' in value) {
    const code = (value as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}
