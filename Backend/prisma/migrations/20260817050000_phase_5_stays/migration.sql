-- Phase 5: check-in, configured services, immutable charges, and check-out.

INSERT INTO "Permission" ("id", "key", "description") VALUES
  (gen_random_uuid(), 'service.view', 'View active configured hotel services'),
  (gen_random_uuid(), 'charge.void', 'Void an incorrect stay charge with a reason')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."isSystem" = true
  AND (
    (p."key" = 'service.view' AND r."name" IN ('ADMIN', 'MANAGER', 'STAFF'))
    OR (p."key" = 'charge.void' AND r."name" IN ('ADMIN', 'MANAGER'))
  )
ON CONFLICT DO NOTHING;

ALTER TABLE "Reservation"
  ADD COLUMN "checkedInAt" TIMESTAMPTZ(3),
  ADD COLUMN "checkedOutAt" TIMESTAMPTZ(3);

-- Safely normalize any pre-Phase-5 manually created stay statuses before the
-- new consistency constraint is installed.
UPDATE "Reservation"
SET "checkedInAt" = coalesce("checkedInAt", "updatedAt")
WHERE "status" IN ('CHECKED_IN', 'CHECKED_OUT');
UPDATE "Reservation"
SET "checkedOutAt" = coalesce("checkedOutAt", "updatedAt")
WHERE "status" = 'CHECKED_OUT';

ALTER TABLE "Reservation"
  ADD CONSTRAINT "Reservation_stay_timestamps_complete" CHECK (
    ("status" = 'CHECKED_IN' AND "checkedInAt" IS NOT NULL AND "checkedOutAt" IS NULL)
    OR ("status" = 'CHECKED_OUT' AND "checkedInAt" IS NOT NULL AND "checkedOutAt" IS NOT NULL AND "checkedOutAt" >= "checkedInAt")
    OR ("status" NOT IN ('CHECKED_IN', 'CHECKED_OUT') AND "checkedInAt" IS NULL AND "checkedOutAt" IS NULL)
  );

ALTER TABLE "Charge"
  ADD COLUMN "reservationRoomId" UUID,
  ADD COLUMN "voidedAt" TIMESTAMPTZ(3),
  ADD COLUMN "voidedById" UUID,
  ADD COLUMN "voidReason" VARCHAR(500);

CREATE UNIQUE INDEX "Charge_reservationRoomId_key" ON "Charge"("reservationRoomId");
CREATE INDEX "Charge_voidedById_idx" ON "Charge"("voidedById");

ALTER TABLE "Charge"
  ADD CONSTRAINT "Charge_reservationRoomId_fkey"
  FOREIGN KEY ("reservationRoomId") REFERENCES "ReservationRoom"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Charge_voidedById_fkey"
  FOREIGN KEY ("voidedById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Charge_total_math"
  CHECK ("totalAmount" = "quantity" * "unitPrice"),
  ADD CONSTRAINT "Charge_source_complete" CHECK (
    ("type" = 'ROOM' AND "reservationRoomId" IS NOT NULL AND "serviceId" IS NULL)
    OR ("type" = 'SERVICE' AND "reservationRoomId" IS NULL AND "serviceId" IS NOT NULL)
    OR ("type" IN ('DISCOUNT', 'OTHER') AND "reservationRoomId" IS NULL AND "serviceId" IS NULL)
  ),
  ADD CONSTRAINT "Charge_void_complete" CHECK (
    ("voidedAt" IS NULL AND "voidedById" IS NULL AND "voidReason" IS NULL)
    OR ("voidedAt" IS NOT NULL AND "voidedById" IS NOT NULL AND coalesce(btrim("voidReason"), '') <> '')
  );

CREATE UNIQUE INDEX "Service_hotel_name_canonical_unique"
  ON "Service" ("hotelId", lower(btrim("name")));
ALTER TABLE "Service"
  ADD CONSTRAINT "Service_name_not_blank" CHECK (btrim("name") <> '');

CREATE OR REPLACE FUNCTION protect_reservation_status_transition()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."status" = OLD."status" THEN RETURN NEW; END IF;
  IF NOT (
    (OLD."status" = 'PENDING' AND NEW."status" IN ('CONFIRMED', 'CANCELLED', 'NO_SHOW'))
    OR (OLD."status" = 'CONFIRMED' AND NEW."status" IN ('CANCELLED', 'NO_SHOW', 'CHECKED_IN'))
    OR (OLD."status" = 'CHECKED_IN' AND NEW."status" = 'CHECKED_OUT')
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'invalid reservation status transition';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Reservation_status_transition"
BEFORE UPDATE OF "status" ON "Reservation"
FOR EACH ROW EXECUTE FUNCTION protect_reservation_status_transition();

CREATE OR REPLACE FUNCTION enforce_charge_integrity()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  reservation_hotel uuid;
  reservation_status "ReservationStatus";
  linked_hotel uuid;
  linked_reservation uuid;
  expected_service_price numeric(14,2);
  expected_rate numeric(14,2);
  expected_nights integer;
BEGIN
  SELECT "hotelId", "status" INTO reservation_hotel, reservation_status
  FROM "Reservation" WHERE "id" = NEW."reservationId" FOR KEY SHARE;
  IF reservation_hotel IS NULL OR reservation_status <> 'CHECKED_IN' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'charges require a checked-in reservation';
  END IF;

  IF NEW."type" = 'SERVICE' THEN
    SELECT "hotelId", "defaultPrice" INTO linked_hotel, expected_service_price FROM "Service"
    WHERE "id" = NEW."serviceId" AND "isActive" = true FOR KEY SHARE;
    IF linked_hotel IS NULL OR linked_hotel <> reservation_hotel
       OR NEW."unitPrice" <> expected_service_price THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'service charge contains an invalid service';
    END IF;
  ELSIF NEW."type" = 'ROOM' THEN
    SELECT rr."reservationId", rr."nightlyRate", (rr."checkOutDate" - rr."checkInDate")
      INTO linked_reservation, expected_rate, expected_nights
    FROM "ReservationRoom" rr WHERE rr."id" = NEW."reservationRoomId" FOR KEY SHARE;
    IF linked_reservation IS NULL OR linked_reservation <> NEW."reservationId"
       OR NEW."unitPrice" <> expected_rate OR NEW."quantity" <> expected_nights THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'room charge does not match its reservation room snapshot';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "Charge_integrity"
BEFORE INSERT ON "Charge"
FOR EACH ROW EXECUTE FUNCTION enforce_charge_integrity();

CREATE OR REPLACE FUNCTION protect_charge_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE reservation_status "ReservationStatus";
DECLARE actor_hotel uuid;
DECLARE reservation_hotel uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'charges cannot be deleted';
  END IF;

  IF OLD."voidedAt" IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'voided charges cannot be changed';
  END IF;

  IF NEW."reservationId" IS DISTINCT FROM OLD."reservationId"
     OR NEW."reservationRoomId" IS DISTINCT FROM OLD."reservationRoomId"
     OR NEW."serviceId" IS DISTINCT FROM OLD."serviceId"
     OR NEW."type" IS DISTINCT FROM OLD."type"
     OR NEW."description" IS DISTINCT FROM OLD."description"
     OR NEW."quantity" IS DISTINCT FROM OLD."quantity"
     OR NEW."unitPrice" IS DISTINCT FROM OLD."unitPrice"
     OR NEW."totalAmount" IS DISTINCT FROM OLD."totalAmount"
     OR NEW."chargeDate" IS DISTINCT FROM OLD."chargeDate" THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'charge financial fields are immutable';
  END IF;

  SELECT "status", "hotelId" INTO reservation_status, reservation_hotel
  FROM "Reservation" WHERE "id" = OLD."reservationId" FOR KEY SHARE;
  SELECT "hotelId" INTO actor_hotel FROM "User" WHERE "id" = NEW."voidedById" FOR KEY SHARE;
  IF reservation_status <> 'CHECKED_IN' OR actor_hotel IS NULL OR actor_hotel <> reservation_hotel THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'charge can only be voided during its stay by a hotel user';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Charge_immutable"
BEFORE UPDATE OR DELETE ON "Charge"
FOR EACH ROW EXECUTE FUNCTION protect_charge_mutation();
