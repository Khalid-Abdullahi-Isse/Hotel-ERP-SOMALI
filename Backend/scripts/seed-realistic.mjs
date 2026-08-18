import 'dotenv/config';
import argon2 from 'argon2';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required.');
const demoPassword = 'HotelDemo2026!';
const demoPasswordHash = await argon2.hash(demoPassword, { type: argon2.argon2id });

const pool = new Pool({ connectionString: databaseUrl });
const client = await pool.connect();

if (process.argv.includes('--refresh-demo-logins')) {
  const result = await client.query(
    `UPDATE "User" SET "passwordHash"=$1,"updatedAt"=now()
     WHERE username ~ '^employee([1-9]|1[0-2])$'`,
    [demoPasswordHash],
  );
  console.log(`Updated ${result.rowCount} demo employee logins. Password: ${demoPassword}`);
  client.release();
  await pool.end();
  process.exit(0);
}

try {
  await client.query('BEGIN');
  await client.query(`
    CREATE TEMP TABLE seed_hotel ON COMMIT DROP AS
    SELECT h.id, h.code,
      (SELECT u.id FROM "User" u WHERE u."hotelId"=h.id AND u."deletedAt" IS NULL ORDER BY u."createdAt" LIMIT 1) actor_id,
      '${demoPasswordHash.replaceAll("'", "''")}'::text password_hash
    FROM "Hotel" h WHERE h."isActive"=true ORDER BY h."createdAt" LIMIT 1;

    DO $$ BEGIN
      IF (SELECT count(*) FROM seed_hotel) <> 1 OR (SELECT actor_id FROM seed_hotel) IS NULL THEN
        RAISE EXCEPTION 'Seed requires one active hotel with a bootstrapped administrator';
      END IF;
      IF EXISTS (SELECT 1 FROM "Reservation" r JOIN seed_hotel h ON h.id=r."hotelId") THEN
        RAISE EXCEPTION 'Hotel already contains reservations; refusing to mix or overwrite operational data';
      END IF;
    END $$;

    UPDATE "Hotel" SET phone='+252 61 555 0100', email='reservations@hudheelhotel.so',
      address='KM4, Maka Al-Mukarama Road, Mogadishu, Somalia',
      "currencyCode"='USD', timezone='Africa/Mogadishu', "updatedAt"=now()
    WHERE id=(SELECT id FROM seed_hotel);

    INSERT INTO "Floor" (id,"hotelId",number,name,"createdAt","updatedAt")
    SELECT gen_random_uuid(),h.id,n,
      (ARRAY['Lobby & Conference','Executive Floor','Garden View','Ocean View','Premium Suites','Skyline Suites'])[n],
      now(),now() FROM seed_hotel h CROSS JOIN generate_series(1,6) n;

    INSERT INTO "RoomType" (id,"hotelId",code,name,description,"capacityAdults","capacityChildren","basePrice","isActive","createdAt","updatedAt")
    SELECT gen_random_uuid(),h.id,v.code,v.name,v.description,v.adults,v.children,v.price,true,now(),now()
    FROM seed_hotel h CROSS JOIN (VALUES
      ('STD','Standard Queen','Comfortable queen room with work desk and city view',2,1,89.00),
      ('DLX','Deluxe King','Spacious king room with premium amenities',2,1,129.00),
      ('TWN','Executive Twin','Two-bed business room for colleagues or families',2,2,149.00),
      ('STE','Junior Suite','Separate lounge, king bed, and panoramic view',3,2,219.00),
      ('FAM','Family Suite','Two-room family accommodation with kitchenette',4,3,279.00),
      ('PRS','Presidential Suite','Luxury suite with dining room and private terrace',4,2,499.00)
    ) v(code,name,description,adults,children,price);

    CREATE TEMP TABLE seed_rooms ON COMMIT DROP AS
    WITH numbered AS (
      SELECT gs rn, ((gs-1)/16)+1 floor_no,
        (((gs-1)/16)+1)::text || lpad((((gs-1)%16)+1)::text,2,'0') room_number,
        (ARRAY['STD','STD','STD','DLX','DLX','TWN','STE','FAM'])[((gs-1)%8)+1] type_code
      FROM generate_series(1,96) gs
    ) SELECT gen_random_uuid() id,h.id hotel_id,f.id floor_id,rt.id room_type_id,n.*
      FROM numbered n CROSS JOIN seed_hotel h
      JOIN "Floor" f ON f."hotelId"=h.id AND f.number=n.floor_no
      JOIN "RoomType" rt ON rt."hotelId"=h.id AND rt.code=n.type_code;

    INSERT INTO "Room" (id,"hotelId","floorId","roomTypeId","roomNumber",status,notes,"isActive","createdAt","updatedAt")
    SELECT id,hotel_id,floor_id,room_type_id,room_number,'AVAILABLE',
      CASE WHEN rn%17=0 THEN 'Quiet room requested often by returning guests' END,true,now(),now() FROM seed_rooms;

    INSERT INTO "Service" (id,"hotelId",name,description,"defaultPrice","isActive","createdAt","updatedAt")
    SELECT gen_random_uuid(),h.id,v.name,v.description,v.price,true,now(),now() FROM seed_hotel h CROSS JOIN (VALUES
      ('Airport Transfer','Private one-way airport transfer',25.00),('Breakfast Buffet','Daily international and Somali breakfast buffet',18.00),
      ('Lunch Buffet','Chef selection lunch buffet',24.00),('Dinner Buffet','Evening buffet with beverages',32.00),
      ('Laundry Service','Same-day laundry service per bag',15.00),('Extra Bed','Rollaway bed per night',20.00),
      ('Conference Room','Meeting room rental per hour',75.00),('Spa Treatment','Sixty-minute wellness treatment',65.00),
      ('Late Checkout','Checkout extension until 5 PM',40.00),('Minibar Package','Assorted snacks and soft drinks',22.00)
    ) v(name,description,price);

    INSERT INTO "PaymentMethod" (id,"hotelId",name,"isActive","createdAt","updatedAt")
    SELECT gen_random_uuid(),h.id,v.name,true,now(),now() FROM seed_hotel h CROSS JOIN
      (VALUES ('Cash'),('Visa / Mastercard'),('EVC Plus'),('Zaad'),('Bank Transfer'),('Corporate Account')) v(name);

    INSERT INTO "ExpenseCategory" (id,"hotelId",name,"isActive","createdAt","updatedAt")
    SELECT gen_random_uuid(),h.id,v.name,true,now(),now() FROM seed_hotel h CROSS JOIN
      (VALUES ('Payroll'),('Utilities'),('Food & Beverage'),('Housekeeping Supplies'),('Repairs & Maintenance'),
              ('Marketing'),('Transportation'),('Security'),('Internet & Software'),('Taxes & Licenses')) v(name);

    CREATE TEMP TABLE seed_users ON COMMIT DROP AS
    SELECT gen_random_uuid() id,h.id hotel_id,h.password_hash,v.n,v.full_name,v.role_name
    FROM seed_hotel h CROSS JOIN (VALUES
      (1,'Amina Hassan','MANAGER'),(2,'Abdi Mohamed','MANAGER'),(3,'Fadumo Ali','STAFF'),
      (4,'Yusuf Ahmed','STAFF'),(5,'Hodan Omar','STAFF'),(6,'Mohamed Nur','STAFF'),
      (7,'Sahra Aden','STAFF'),(8,'Ibrahim Warsame','STAFF'),(9,'Maryan Ismail','STAFF'),
      (10,'Ahmed Jama','STAFF'),(11,'Nasteho Farah','STAFF'),(12,'Khalid Osman','STAFF')) v(n,full_name,role_name);

    INSERT INTO "User" (id,"hotelId",email,username,"passwordHash","fullName",status,"createdAt","updatedAt")
    SELECT id,hotel_id,'employee'||n||'@hudheelhotel.so','employee'||n,password_hash,full_name,'ACTIVE',now(),now() FROM seed_users;
    INSERT INTO "UserRole" ("userId","roleId","assignedAt")
    SELECT su.id,r.id,now() FROM seed_users su JOIN "Role" r ON r."hotelId"=su.hotel_id AND r.name=su.role_name;

    CREATE TEMP TABLE seed_guests ON COMMIT DROP AS
    SELECT gen_random_uuid() id,h.id hotel_id,gs n,
      (ARRAY['Ahmed','Mohamed','Abdi','Hassan','Yusuf','Ibrahim','Omar','Ali','Khalid','Mustafa','Amina','Fadumo','Hodan','Sahra','Maryan','Nasteho'])[((gs-1)%16)+1]
      || ' ' ||
      (ARRAY['Abdullahi','Warsame','Jama','Nur','Ismail','Farah','Osman','Aden','Hussein','Mire','Roble','Dahir'])[((gs*7-1)%12)+1] full_name,
      (ARRAY['Somalia','Kenya','Ethiopia','Djibouti','United Kingdom','United States','United Arab Emirates','Turkey','Qatar','Sweden'])[((gs*3-1)%10)+1] nationality
    FROM seed_hotel h CROSS JOIN generate_series(1,3600) gs;

    INSERT INTO "Guest" (id,"hotelId","fullName",phone,"normalizedPhone",email,"normalizedEmail","passportNumber","nationalId",nationality,address,notes,"createdAt","updatedAt")
    SELECT id,hotel_id,full_name,'+25261'||lpad((1000000+n)::text,7,'0'),'+25261'||lpad((1000000+n)::text,7,'0'),
      lower(replace(full_name,' ','.'))||n||'@example.com',lower(replace(full_name,' ','.'))||n||'@example.com',
      CASE WHEN n%3=0 THEN 'P'||lpad((7000000+n)::text,8,'0') END,
      CASE WHEN n%3<>0 THEN 'NID-'||lpad(n::text,8,'0') END,nationality,
      (ARRAY['Mogadishu','Hargeisa','Nairobi','Addis Ababa','Djibouti City','Dubai','London','Stockholm'])[((n-1)%8)+1],
      CASE WHEN n%19=0 THEN 'Returning guest; prefers a quiet room and late arrival.' END,
      now()-(n%540)*interval '1 day',now() FROM seed_guests;

    CREATE TEMP TABLE seed_reservations ON COMMIT DROP AS
    WITH schedule AS (
      SELECT gen_random_uuid() id,r.id room_id,r.room_type_id,r.rn,
        (r.rn-1)*90+n+1 seq,
        (current_date-420 + (r.rn%7) + n*7)::date check_in,
        (current_date-420 + (r.rn%7) + n*7 + 2 + ((r.rn+n)%4))::date check_out,
        n FROM seed_rooms r CROSS JOIN generate_series(0,89) n
    ), classified AS (
      SELECT s.*,
        CASE
          WHEN rn>=94 AND check_out>current_date THEN 'CANCELLED'
          WHEN check_out<=current_date AND seq%20=0 THEN 'CANCELLED'
          WHEN check_out<=current_date AND seq%25=0 THEN 'NO_SHOW'
          WHEN check_out<=current_date THEN 'CHECKED_OUT'
          WHEN check_in<=current_date THEN 'CHECKED_IN'
          WHEN seq%20=0 THEN 'CANCELLED'
          WHEN seq%10=0 THEN 'PENDING'
          ELSE 'CONFIRMED' END target_status
      FROM schedule s
    ) SELECT c.*,g.id guest_id,rt."basePrice" nightly_rate
      FROM classified c JOIN seed_guests g ON g.n=((c.seq*13)%3600)+1
      JOIN "RoomType" rt ON rt.id=c.room_type_id;

    INSERT INTO "Reservation" (id,"hotelId","guestId","bookingNumber",status,"checkInDate","checkOutDate",adults,children,"discountAmount",notes,"cancelledAt","cancellationNote","checkedInAt","createdAt","updatedAt")
    SELECT sr.id,h.id,sr.guest_id,'RSV-'||to_char(sr.check_in,'YYMMDD')||'-'||lpad(sr.seq::text,6,'0'),
      CASE WHEN sr.target_status='CHECKED_OUT' THEN 'CHECKED_IN' ELSE sr.target_status::"ReservationStatus" END,
      sr.check_in,sr.check_out,1+(sr.seq%2),CASE WHEN sr.seq%5=0 THEN 1 ELSE 0 END,
      CASE WHEN sr.seq%23=0 THEN round((sr.nightly_rate*0.1)::numeric,2) ELSE 0 END,
      (ARRAY['Direct website booking','Corporate traveler','Airport pickup requested','High floor requested','Anniversary stay',NULL])[((sr.seq-1)%6)+1],
      CASE WHEN sr.target_status='CANCELLED' THEN least(now(),sr.check_in::timestamp-interval '2 days') END,
      CASE WHEN sr.target_status='CANCELLED' THEN (ARRAY['Guest changed travel plans','Flight cancelled','Duplicate booking','Corporate trip postponed'])[((sr.seq-1)%4)+1] END,
      CASE WHEN sr.target_status IN ('CHECKED_OUT','CHECKED_IN') THEN sr.check_in::timestamp+interval '14 hours' END,
      sr.check_in::timestamp-((14+(sr.seq%75))*interval '1 day'),now()
    FROM seed_reservations sr CROSS JOIN seed_hotel h;

    CREATE TEMP TABLE seed_reservation_rooms ON COMMIT DROP AS
    SELECT gen_random_uuid() id,sr.id reservation_id,sr.room_id,sr.check_in,sr.check_out,sr.nightly_rate FROM seed_reservations sr;
    INSERT INTO "ReservationRoom" (id,"reservationId","roomId","checkInDate","checkOutDate","nightlyRate","bookingStatus","createdAt","updatedAt")
    SELECT id,reservation_id,room_id,check_in,check_out,nightly_rate,'PENDING',now(),now() FROM seed_reservation_rooms;

    CREATE TEMP TABLE seed_charges (id uuid,reservation_id uuid,type "ChargeType",description varchar(255),quantity numeric(10,2),unit_price numeric(14,2),total numeric(14,2),reservation_room_id uuid,service_id uuid,charge_date timestamptz);
    INSERT INTO seed_charges
    SELECT gen_random_uuid(),sr.id,'ROOM','Room accommodation — '||(sr.check_out-sr.check_in)||' nights',
      (sr.check_out-sr.check_in),sr.nightly_rate,(sr.check_out-sr.check_in)*sr.nightly_rate,rr.id,NULL,sr.check_out::timestamp+interval '8 hours'
    FROM seed_reservations sr JOIN seed_reservation_rooms rr ON rr.reservation_id=sr.id WHERE sr.target_status='CHECKED_OUT';
    INSERT INTO seed_charges
    SELECT gen_random_uuid(),sr.id,'SERVICE',svc.name,1+(sr.seq%2),svc."defaultPrice",(1+(sr.seq%2))*svc."defaultPrice",NULL,svc.id,
      sr.check_in::timestamp+interval '18 hours'
    FROM seed_reservations sr CROSS JOIN LATERAL (
      SELECT s.* FROM "Service" s JOIN seed_hotel h ON h.id=s."hotelId" ORDER BY s.name OFFSET (sr.seq%10) LIMIT 1
    ) svc WHERE sr.target_status='CHECKED_OUT' AND sr.seq%100<48;
    INSERT INTO "Charge" (id,"reservationId","reservationRoomId","serviceId",type,description,quantity,"unitPrice","totalAmount","chargeDate","createdAt")
    SELECT id,reservation_id,reservation_room_id,service_id,type,description,quantity,unit_price,total,charge_date,charge_date FROM seed_charges;

    UPDATE "Reservation" r SET status='CHECKED_OUT',"checkedOutAt"=sr.check_out::timestamp+interval '10 hours',"updatedAt"=sr.check_out::timestamp+interval '10 hours'
    FROM seed_reservations sr WHERE r.id=sr.id AND sr.target_status='CHECKED_OUT';

    INSERT INTO "ReservationHistory" (id,"reservationId","fromStatus","toStatus",note,"changedById","createdAt")
    SELECT gen_random_uuid(),sr.id,NULL,CASE WHEN sr.target_status='CHECKED_OUT' THEN 'CONFIRMED' ELSE sr.target_status::"ReservationStatus" END,
      'Reservation created',h.actor_id,sr.check_in::timestamp-interval '10 days' FROM seed_reservations sr CROSS JOIN seed_hotel h;
    INSERT INTO "ReservationHistory" (id,"reservationId","fromStatus","toStatus",note,"changedById","createdAt")
    SELECT gen_random_uuid(),sr.id,'CONFIRMED','CHECKED_IN','Guest identity verified at front desk',h.actor_id,sr.check_in::timestamp+interval '14 hours'
    FROM seed_reservations sr CROSS JOIN seed_hotel h WHERE sr.target_status='CHECKED_OUT';
    INSERT INTO "ReservationHistory" (id,"reservationId","fromStatus","toStatus",note,"changedById","createdAt")
    SELECT gen_random_uuid(),sr.id,'CHECKED_IN','CHECKED_OUT','Folio settled and keys returned',h.actor_id,sr.check_out::timestamp+interval '10 hours'
    FROM seed_reservations sr CROSS JOIN seed_hotel h WHERE sr.target_status='CHECKED_OUT';

    CREATE TEMP TABLE seed_invoices ON COMMIT DROP AS
    SELECT gen_random_uuid() id,sr.id reservation_id,sr.seq,sum(c.total) subtotal,
      CASE WHEN sr.seq%23=0 THEN round((sum(c.total)*0.1)::numeric,2) ELSE 0 END discount,
      CASE WHEN sr.seq%20<13 THEN 'PAID' WHEN sr.seq%20<17 THEN 'PARTIALLY_PAID' WHEN sr.seq%20<19 THEN 'ISSUED' ELSE 'VOIDED' END invoice_status,sr.check_out
    FROM seed_reservations sr JOIN seed_charges c ON c.reservation_id=sr.id
    WHERE sr.target_status='CHECKED_OUT' AND sr.seq%100<85 GROUP BY sr.id,sr.seq,sr.check_out;
    INSERT INTO "Invoice" (id,"hotelId","reservationId","invoiceNumber",status,subtotal,"discountAmount","totalAmount","createdAt","updatedAt")
    SELECT si.id,h.id,si.reservation_id,'INV-'||to_char(si.check_out,'YYMM')||'-'||lpad(si.seq::text,6,'0'),'DRAFT',si.subtotal,si.discount,si.subtotal-si.discount,si.check_out::timestamp+interval '10 hours',now()
    FROM seed_invoices si CROSS JOIN seed_hotel h;
    INSERT INTO "InvoiceItem" (id,"invoiceId","chargeId",description,quantity,"unitPrice",amount,"createdAt")
    SELECT gen_random_uuid(),si.id,c.id,c.description,c.quantity,c.unit_price,c.total,si.check_out::timestamp+interval '10 hours'
    FROM seed_invoices si JOIN seed_charges c ON c.reservation_id=si.reservation_id;
    UPDATE "Invoice" i SET status=si.invoice_status::"InvoiceStatus", "issuedAt"=si.check_out::timestamp+interval '10 hours',"issuedById"=h.actor_id,
      "voidedAt"=CASE WHEN si.invoice_status='VOIDED' THEN si.check_out::timestamp+interval '11 hours' END,
      "voidedById"=CASE WHEN si.invoice_status='VOIDED' THEN h.actor_id END,
      "voidReason"=CASE WHEN si.invoice_status='VOIDED' THEN 'Reissued after billing-address correction' END,"updatedAt"=now()
    FROM seed_invoices si CROSS JOIN seed_hotel h WHERE i.id=si.id;

    INSERT INTO "Payment" (id,"hotelId","reservationId","invoiceId","guestId","paymentMethodId","createdById","requestKey",kind,status,amount,reference,note,"paidAt","createdAt")
    SELECT gen_random_uuid(),h.id,si.reservation_id,si.id,r."guestId",pm.id,h.actor_id,gen_random_uuid(),'PAYMENT','COMPLETED',
      CASE WHEN si.invoice_status='PAID' THEN i."totalAmount" ELSE round((i."totalAmount"*0.5)::numeric,2) END,
      'PAY-'||lpad(si.seq::text,8,'0'),'Payment received at checkout',si.check_out::timestamp+interval '9 hours',si.check_out::timestamp+interval '9 hours'
    FROM seed_invoices si JOIN "Invoice" i ON i.id=si.id JOIN "Reservation" r ON r.id=si.reservation_id CROSS JOIN seed_hotel h
    JOIN LATERAL (SELECT p.id FROM "PaymentMethod" p WHERE p."hotelId"=h.id ORDER BY p.name OFFSET (si.seq%6) LIMIT 1) pm ON true
    WHERE si.invoice_status IN ('PAID','PARTIALLY_PAID');
    INSERT INTO "Payment" (id,"hotelId","reservationId","guestId","paymentMethodId","createdById","requestKey",kind,status,amount,reference,note,"paidAt","createdAt")
    SELECT gen_random_uuid(),h.id,sr.id,sr.guest_id,pm.id,h.actor_id,gen_random_uuid(),'PAYMENT','COMPLETED',round((sr.nightly_rate*0.3)::numeric,2),
      'DEP-'||lpad(sr.seq::text,8,'0'),'Advance reservation deposit',now()-(sr.seq%30)*interval '1 day',now()-(sr.seq%30)*interval '1 day'
    FROM seed_reservations sr CROSS JOIN seed_hotel h
    JOIN LATERAL (SELECT p.id FROM "PaymentMethod" p WHERE p."hotelId"=h.id ORDER BY p.name OFFSET (sr.seq%6) LIMIT 1) pm ON true
    WHERE sr.target_status IN ('CONFIRMED','PENDING') AND sr.seq%3=0;

    INSERT INTO "Expense" (id,"hotelId","categoryId","paymentMethodId","createdById","requestKey",amount,"expenseDate",description,reference,"reversedAt","reversedById","reversalReason","createdAt","updatedAt")
    SELECT gen_random_uuid(),h.id,ec.id,pm.id,h.actor_id,gen_random_uuid(),round((35+(gs*37)%2400)::numeric,2),current_date-(gs%540),
      (ARRAY['Monthly supplier invoice','Operational procurement','Scheduled contract payment','Emergency purchase','Department reimbursement'])[((gs-1)%5)+1],
      'EXP-'||to_char(current_date-(gs%540),'YYMM')||'-'||lpad(gs::text,5,'0'),
      CASE WHEN gs%41=0 THEN now() END,CASE WHEN gs%41=0 THEN h.actor_id END,CASE WHEN gs%41=0 THEN 'Duplicate vendor submission' END,
      (current_date-(gs%540))::timestamp+interval '9 hours',now()
    FROM generate_series(1,1200) gs CROSS JOIN seed_hotel h
    JOIN LATERAL (SELECT id FROM "ExpenseCategory" e WHERE e."hotelId"=h.id ORDER BY name OFFSET (gs%10) LIMIT 1) ec ON true
    JOIN LATERAL (SELECT id FROM "PaymentMethod" p WHERE p."hotelId"=h.id ORDER BY name OFFSET (gs%6) LIMIT 1) pm ON true;

    UPDATE "Room" room SET status=CASE WHEN sr.rn%11=0 THEN 'DIRTY'::"RoomStatus" WHEN sr.rn%13=0 THEN 'CLEANING'::"RoomStatus" ELSE 'AVAILABLE'::"RoomStatus" END,"updatedAt"=now()
    FROM seed_rooms sr WHERE room.id=sr.id;
    UPDATE "Room" room SET status='OCCUPIED',"updatedAt"=now() FROM seed_reservations sr WHERE room.id=sr.room_id AND sr.target_status='CHECKED_IN';
    UPDATE "Room" room SET status='MAINTENANCE',"updatedAt"=now() FROM seed_rooms sr WHERE room.id=sr.id AND sr.rn>=94;

    INSERT INTO "HousekeepingTask" (id,"hotelId","roomId","reservationId","assignedToId",status,notes,"startedAt","completedAt","createdAt","updatedAt")
    SELECT gen_random_uuid(),h.id,sr.room_id,sr.id,su.id,'COMPLETED','Checkout cleaning completed and minibar restocked',
      sr.check_out::timestamp+interval '10 hours 15 minutes',sr.check_out::timestamp+interval '11 hours',sr.check_out::timestamp+interval '10 hours',now()
    FROM seed_reservations sr CROSS JOIN seed_hotel h JOIN seed_users su ON su.n=((sr.seq%12)+1)
    WHERE sr.target_status='CHECKED_OUT' AND sr.seq%17=0;
    INSERT INTO "HousekeepingTask" (id,"hotelId","roomId","assignedToId",status,notes,"startedAt","createdAt","updatedAt")
    SELECT gen_random_uuid(),h.id,r.id,su.id,CASE WHEN room.status='CLEANING' THEN 'CLEANING'::"HousekeepingStatus" ELSE 'DIRTY'::"HousekeepingStatus" END,
      'Priority turnover for next arrival',CASE WHEN room.status='CLEANING' THEN now()-interval '25 minutes' END,now()-interval '1 hour',now()
    FROM seed_rooms r JOIN "Room" room ON room.id=r.id CROSS JOIN seed_hotel h JOIN seed_users su ON su.n=((r.rn%12)+1)
    WHERE room.status IN ('DIRTY','CLEANING');

    INSERT INTO "MaintenanceRequest" (id,"hotelId","roomId","assignedToId","createdById",problem,status,cost,notes,"completedAt","startedAt","previousRoomStatus","createdAt","updatedAt")
    SELECT gen_random_uuid(),h.id,r.id,su.id,h.actor_id,
      (ARRAY['Air conditioner not cooling','Bathroom faucet leaking','Television signal intermittent','Door lock battery replacement','Water heater inspection'])[((r.rn-1)%5)+1],
      'DONE',45+(r.rn%9)*22,'Repair tested and signed off by engineering',now()-(r.rn%60)*interval '1 day',now()-(r.rn%60)*interval '1 day 2 hours','AVAILABLE',now()-(r.rn%60)*interval '1 day 3 hours',now()
    FROM seed_rooms r CROSS JOIN seed_hotel h JOIN seed_users su ON su.n=((r.rn%12)+1) WHERE r.rn%4=0;
    INSERT INTO "MaintenanceRequest" (id,"hotelId","roomId","assignedToId","createdById",problem,status,notes,"startedAt","previousRoomStatus","createdAt","updatedAt")
    SELECT gen_random_uuid(),h.id,r.id,su.id,h.actor_id,CASE WHEN r.rn=94 THEN 'Preventive air-conditioning service' ELSE 'Bathroom plumbing repair' END,
      CASE WHEN r.rn=94 THEN 'OPEN'::"MaintenanceStatus" ELSE 'IN_PROGRESS'::"MaintenanceStatus" END,'Room blocked from sale until engineering clearance',
      CASE WHEN r.rn<>94 THEN now()-interval '45 minutes' END,CASE WHEN r.rn<>94 THEN 'AVAILABLE'::"RoomStatus" END,now()-interval '2 hours',now()
    FROM seed_rooms r CROSS JOIN seed_hotel h JOIN seed_users su ON su.n=((r.rn%12)+1) WHERE r.rn IN (94,95);

    INSERT INTO "AuditLog" (id,"hotelId","userId",action,"entityType","entityId","oldValue","newValue","ipAddress","userAgent","createdAt")
    SELECT gen_random_uuid(),h.id,CASE WHEN gs%7=0 THEN h.actor_id ELSE su.id END,
      (ARRAY['reservation.created','reservation.confirmed','guest.updated','payment.created','invoice.issued','housekeeping.completed','room.updated','expense.created'])[((gs-1)%8)+1],
      (ARRAY['Reservation','Reservation','Guest','Payment','Invoice','HousekeepingTask','Room','Expense'])[((gs-1)%8)+1],gen_random_uuid(),
      CASE WHEN gs%3=0 THEN jsonb_build_object('status','previous') END,jsonb_build_object('source','realistic-seed','sequence',gs),
      '127.0.0.1','Hotel ERP Web/1.0',now()-(gs%180)*interval '1 day'-(gs%24)*interval '1 hour'
    FROM generate_series(1,3000) gs CROSS JOIN seed_hotel h JOIN seed_users su ON su.n=((gs%12)+1);
  `);

  const { rows } = await client.query(`
    SELECT h.code,
      (SELECT count(*)::int FROM "Room" x WHERE x."hotelId"=h.id) rooms,
      (SELECT count(*)::int FROM "Guest" x WHERE x."hotelId"=h.id) guests,
      (SELECT count(*)::int FROM "Reservation" x WHERE x."hotelId"=h.id) reservations,
      (SELECT count(*)::int FROM "Invoice" x WHERE x."hotelId"=h.id) invoices,
      (SELECT count(*)::int FROM "Payment" x WHERE x."hotelId"=h.id) payments,
      (SELECT count(*)::int FROM "Expense" x WHERE x."hotelId"=h.id) expenses,
      (SELECT count(*)::int FROM "HousekeepingTask" x WHERE x."hotelId"=h.id) housekeeping,
      (SELECT count(*)::int FROM "MaintenanceRequest" x WHERE x."hotelId"=h.id) maintenance,
      (SELECT count(*)::int FROM "AuditLog" x WHERE x."hotelId"=h.id) audit_logs
    FROM "Hotel" h JOIN seed_hotel s ON s.id=h.id;
  `);
  await client.query('COMMIT');
  console.table(rows);
  console.log('Realistic hotel data loaded successfully.');
  console.log(`Demo manager login: employee1 / ${demoPassword}`);
} catch (error) {
  await client.query('ROLLBACK');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
