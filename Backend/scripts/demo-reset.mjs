import 'dotenv/config';
import argon2 from 'argon2';
import { Pool } from 'pg';

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
};

if (process.env.DEMO_MODE !== 'true') {
  throw new Error('Refusing demo reset: DEMO_MODE must be exactly true.');
}
if (!process.argv.includes('--confirm=RESET_DEMO_DATA')) {
  throw new Error('Refusing demo reset: pass --confirm=RESET_DEMO_DATA.');
}

const databaseUrl = required('DATABASE_URL');
const parsedDatabaseUrl = new URL(databaseUrl);
const databaseName = decodeURIComponent(parsedDatabaseUrl.pathname.replace(/^\//, ''));
if (!/_demo$/i.test(databaseName)) {
  throw new Error(
    `Refusing demo reset: database ${databaseName || '(unknown)'} does not end in _demo.`,
  );
}

const hotelCode = required('DEMO_HOTEL_CODE').toUpperCase();
const allowedHotelCode = required('DEMO_RESET_ALLOWED_HOTEL_CODE').toUpperCase();
if (hotelCode !== allowedHotelCode) {
  throw new Error(
    'Refusing demo reset: DEMO_HOTEL_CODE does not match DEMO_RESET_ALLOWED_HOTEL_CODE.',
  );
}
if (!/^[A-Z0-9_-]{2,32}$/.test(hotelCode)) {
  throw new Error('DEMO_HOTEL_CODE must contain only letters, numbers, _ or -.');
}

const managerUsername = required('DEMO_MANAGER_USERNAME').toLowerCase();
const managerEmail = required('DEMO_MANAGER_EMAIL').toLowerCase();
const managerFullName = required('DEMO_MANAGER_FULL_NAME');
const managerPassword = required('DEMO_MANAGER_PASSWORD');
if (managerPassword.length < 12 || managerPassword.length > 128) {
  throw new Error('DEMO_MANAGER_PASSWORD must be 12 to 128 characters.');
}
if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(managerUsername)) {
  throw new Error('DEMO_MANAGER_USERNAME is invalid.');
}

const passwordHash = await argon2.hash(managerPassword, {
  type: argon2.argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
  hashLength: 32,
});
const pool = new Pool({ connectionString: databaseUrl });
const client = await pool.connect();

try {
  await client.query('BEGIN');
  const hotelResult = await client.query(
    `SELECT id, name FROM "Hotel" WHERE code=$1 AND "isActive"=true FOR UPDATE`,
    [hotelCode],
  );
  if (hotelResult.rowCount !== 1) {
    throw new Error(`Expected one active bootstrapped hotel with code ${hotelCode}.`);
  }
  const hotelId = hotelResult.rows[0].id;
  const managerRole = await client.query(
    `SELECT id FROM "Role" WHERE "hotelId"=$1 AND name='MANAGER' AND "isActive"=true`,
    [hotelId],
  );
  if (managerRole.rowCount !== 1) {
    throw new Error('The MANAGER system role is missing. Run bootstrap:admin first.');
  }

  const deletionStatements = [
    `DELETE FROM "RefreshToken" WHERE "sessionId" IN (SELECT s.id FROM "AuthSession" s JOIN "User" u ON u.id=s."userId" WHERE u."hotelId"=$1)`,
    `DELETE FROM "AuthSession" WHERE "userId" IN (SELECT id FROM "User" WHERE "hotelId"=$1)`,
    `DELETE FROM "JournalLine" WHERE "journalEntryId" IN (SELECT id FROM "JournalEntry" WHERE "hotelId"=$1)`,
    `DELETE FROM "JournalEntry" WHERE "hotelId"=$1`,
    `DELETE FROM "AccountingSequence" WHERE "hotelId"=$1`,
    `DELETE FROM "AccountingSettings" WHERE "hotelId"=$1`,
    `DELETE FROM "InvoiceItem" WHERE "invoiceId" IN (SELECT id FROM "Invoice" WHERE "hotelId"=$1)`,
    `DELETE FROM "Payment" WHERE "hotelId"=$1`,
    `DELETE FROM "Invoice" WHERE "hotelId"=$1`,
    `DELETE FROM "HousekeepingTask" WHERE "hotelId"=$1`,
    `DELETE FROM "MaintenanceRequest" WHERE "hotelId"=$1`,
    `DELETE FROM "Charge" WHERE "reservationId" IN (SELECT id FROM "Reservation" WHERE "hotelId"=$1)`,
    `DELETE FROM "ReservationHistory" WHERE "reservationId" IN (SELECT id FROM "Reservation" WHERE "hotelId"=$1)`,
    `DELETE FROM "ReservationRoom" WHERE "reservationId" IN (SELECT id FROM "Reservation" WHERE "hotelId"=$1)`,
    `DELETE FROM "Reservation" WHERE "hotelId"=$1`,
    `DELETE FROM "Expense" WHERE "hotelId"=$1`,
    `DELETE FROM "Guest" WHERE "hotelId"=$1`,
    `DELETE FROM "Room" WHERE "hotelId"=$1`,
    `DELETE FROM "Floor" WHERE "hotelId"=$1`,
    `DELETE FROM "RoomType" WHERE "hotelId"=$1`,
    `DELETE FROM "Service" WHERE "hotelId"=$1`,
    `DELETE FROM "PaymentMethod" WHERE "hotelId"=$1`,
    `DELETE FROM "ExpenseCategory" WHERE "hotelId"=$1`,
    `DELETE FROM "AccountingJournal" WHERE "hotelId"=$1`,
    `DELETE FROM "Account" WHERE "hotelId"=$1`,
    `DELETE FROM "AuditLog" WHERE "hotelId"=$1`,
  ];
  for (const statement of deletionStatements) {
    await client.query(statement, [hotelId]);
  }

  await client.query(
    `UPDATE "Hotel" SET name='Hudheel Demo Hotel', phone='+252 61 555 0100',
      email='reservations@demo-hotel.example', address='KM4, Mogadishu, Somalia',
      "currencyCode"='USD', timezone='Africa/Mogadishu', "updatedAt"=now()
     WHERE id=$1`,
    [hotelId],
  );
  await client.query(
    `INSERT INTO "Floor" (id,"hotelId",number,name,"createdAt","updatedAt")
     SELECT gen_random_uuid(),$1,v.number,v.name,now(),now() FROM (VALUES
       (1,'Lobby Level'),(2,'Executive Floor'),(3,'Ocean View')
     ) v(number,name)`,
    [hotelId],
  );
  await client.query(
    `INSERT INTO "RoomType" (id,"hotelId",code,name,description,"capacityAdults","capacityChildren","basePrice","isActive","createdAt","updatedAt")
     SELECT gen_random_uuid(),$1,v.code,v.name,v.description,v.adults,v.children,v.price,true,now(),now() FROM (VALUES
       ('STD','Standard Queen','Comfortable queen room with a work desk',2,1,89.00),
       ('DLX','Deluxe King','Spacious king room with premium amenities',2,1,129.00),
       ('TWN','Executive Twin','Two-bed business room',2,2,149.00),
       ('STE','Junior Suite','Separate lounge and panoramic view',3,2,219.00)
     ) v(code,name,description,adults,children,price)`,
    [hotelId],
  );
  await client.query(
    `INSERT INTO "Room" (id,"hotelId","floorId","roomTypeId","roomNumber",status,"isActive","createdAt","updatedAt")
     SELECT gen_random_uuid(),$1,f.id,rt.id,v.room_number,'AVAILABLE',true,now(),now()
     FROM (VALUES
       (1,'101','STD'),(1,'102','STD'),(1,'103','DLX'),(1,'104','TWN'),
       (2,'201','STD'),(2,'202','DLX'),(2,'203','TWN'),(2,'204','DLX'),
       (3,'301','STD'),(3,'302','DLX'),(3,'303','TWN'),(3,'304','STE')
     ) v(floor_number,room_number,type_code)
     JOIN "Floor" f ON f."hotelId"=$1 AND f.number=v.floor_number
     JOIN "RoomType" rt ON rt."hotelId"=$1 AND rt.code=v.type_code`,
    [hotelId],
  );
  await client.query(
    `INSERT INTO "Service" (id,"hotelId",name,description,"defaultPrice","isActive","createdAt","updatedAt")
     SELECT gen_random_uuid(),$1,v.name,v.description,v.price,true,now(),now() FROM (VALUES
       ('Airport Transfer','Private one-way airport transfer',25.00),
       ('Breakfast Buffet','Somali and international breakfast buffet',18.00),
       ('Laundry Service','Same-day laundry service per bag',15.00),
       ('Late Checkout','Checkout extension until 5 PM',40.00),
       ('Minibar Package','Assorted snacks and soft drinks',22.00)
     ) v(name,description,price)`,
    [hotelId],
  );
  await client.query(
    `INSERT INTO "PaymentMethod" (id,"hotelId",name,"isActive","createdAt","updatedAt")
     SELECT gen_random_uuid(),$1,v.name,true,now(),now() FROM (VALUES
       ('Cash'),('Visa / Mastercard'),('EVC Plus'),('Zaad'),('Bank Transfer')
     ) v(name)`,
    [hotelId],
  );
  await client.query(
    `INSERT INTO "ExpenseCategory" (id,"hotelId",name,"isActive","createdAt","updatedAt")
     SELECT gen_random_uuid(),$1,v.name,true,now(),now() FROM (VALUES
       ('Utilities'),('Food & Beverage'),('Housekeeping Supplies'),('Repairs & Maintenance')
     ) v(name)`,
    [hotelId],
  );

  const existingManager = await client.query(
    `SELECT id FROM "User" WHERE username=$1 OR email=$2`,
    [managerUsername, managerEmail],
  );
  let managerId;
  if (existingManager.rowCount === 0) {
    const created = await client.query(
      `INSERT INTO "User" (id,"hotelId",email,username,"passwordHash","fullName",status,"createdAt","updatedAt")
       VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,'ACTIVE',now(),now()) RETURNING id`,
      [hotelId, managerEmail, managerUsername, passwordHash, managerFullName],
    );
    managerId = created.rows[0].id;
  } else if (existingManager.rowCount === 1) {
    managerId = existingManager.rows[0].id;
    const updated = await client.query(
      `UPDATE "User" SET email=$2, username=$3, "passwordHash"=$4, "fullName"=$5,
        status='ACTIVE', "failedLoginAttempts"=0, "lockedUntil"=NULL, "deletedAt"=NULL, "updatedAt"=now()
       WHERE id=$6 AND "hotelId"=$1`,
      [hotelId, managerEmail, managerUsername, passwordHash, managerFullName, managerId],
    );
    if (updated.rowCount !== 1)
      throw new Error('The demo manager identity belongs to another hotel.');
  } else {
    throw new Error('The demo manager username and email resolve to different users.');
  }
  await client.query(`DELETE FROM "UserRole" WHERE "userId"=$1`, [managerId]);
  await client.query(
    `INSERT INTO "UserRole" ("userId","roleId","assignedAt") VALUES ($1,$2,now())`,
    [managerId, managerRole.rows[0].id],
  );
  await client.query(
    `INSERT INTO "AuditLog" (id,"hotelId","userId",action,"entityType","entityId","newValue","createdAt")
     VALUES (gen_random_uuid(),$1,$2,'demo.reset','Hotel',$1,$3::jsonb,now())`,
    [hotelId, managerId, JSON.stringify({ rooms: 12, services: 5, paymentMethods: 5 })],
  );

  await client.query('COMMIT');
  process.stdout.write(
    `Demo reset complete for ${hotelResult.rows[0].name} (${hotelCode}) in ${databaseName}. ` +
      `Created 12 available rooms, 5 services, and 5 payment methods. Credentials were not printed.\n`,
  );
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
