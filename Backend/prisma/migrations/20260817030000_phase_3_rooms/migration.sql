-- Phase 3: hotel inventory and centralized room-type pricing.
-- Room prices are configured once on RoomType; operational staff never enter
-- or override a room price.

-- Canonicalize existing identifiers before adding strict checks. If two legacy
-- values collapse to the same canonical value, the existing unique constraints
-- intentionally stop the migration so an operator can resolve the ambiguity.
UPDATE "Hotel"
SET "code" = upper(btrim("code")),
    "currencyCode" = upper(btrim("currencyCode"));

UPDATE "RoomType"
SET "code" = upper(btrim("code")),
    "name" = btrim("name");

UPDATE "Room"
SET "roomNumber" = upper(btrim("roomNumber"));

ALTER TABLE "Hotel"
  ADD CONSTRAINT "Hotel_code_canonical"
  CHECK ("code" = upper(btrim("code")));

ALTER TABLE "RoomType"
  ADD CONSTRAINT "RoomType_code_canonical"
  CHECK ("code" = upper(btrim("code")) AND btrim("code") <> ''),
  ADD CONSTRAINT "RoomType_name_not_blank"
  CHECK (btrim("name") <> '');

CREATE UNIQUE INDEX "RoomType_hotel_name_canonical_unique"
  ON "RoomType" ("hotelId", lower(btrim("name")));

ALTER TABLE "Room"
  ADD CONSTRAINT "Room_number_canonical"
  CHECK ("roomNumber" = upper(btrim("roomNumber")));

-- Pricing has one source of truth: RoomType.basePrice.
ALTER TABLE "Room" DROP CONSTRAINT IF EXISTS "Room_price_override_nonnegative";
ALTER TABLE "Room" DROP COLUMN "priceOverride";

-- An empty floor may be deleted, but a populated floor must never silently
-- detach its rooms, including during concurrent writes.
ALTER TABLE "Room" DROP CONSTRAINT "Room_floorId_fkey";
ALTER TABLE "Room"
  ADD CONSTRAINT "Room_floorId_fkey"
  FOREIGN KEY ("floorId") REFERENCES "Floor"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Replace the Phase 1 tenant-link function so a Room validates both its room
-- type and optional floor. PostgreSQL remains the final tenant boundary even if
-- application validation is accidentally bypassed.
CREATE OR REPLACE FUNCTION enforce_tenant_links()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE linked_hotel uuid;
DECLARE floor_hotel uuid;
DECLARE room_type_active boolean;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'Reservation' THEN
      SELECT "hotelId" INTO linked_hotel FROM "Guest" WHERE "id" = NEW."guestId";
    WHEN 'Invoice' THEN
      SELECT "hotelId" INTO linked_hotel FROM "Reservation" WHERE "id" = NEW."reservationId";
    WHEN 'Room' THEN
      SELECT "hotelId", "isActive" INTO linked_hotel, room_type_active
        FROM "RoomType" WHERE "id" = NEW."roomTypeId" FOR KEY SHARE;
      IF NOT coalesce(room_type_active, false) THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Room requires an active room type';
      END IF;
      IF NEW."floorId" IS NOT NULL THEN
        SELECT "hotelId" INTO floor_hotel FROM "Floor" WHERE "id" = NEW."floorId";
        IF floor_hotel IS NULL OR floor_hotel <> NEW."hotelId" THEN
          RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Room contains a cross-hotel floor reference';
        END IF;
      END IF;
    WHEN 'Expense' THEN
      SELECT "hotelId" INTO linked_hotel FROM "ExpenseCategory" WHERE "id" = NEW."categoryId";
    WHEN 'HousekeepingTask' THEN
      SELECT "hotelId" INTO linked_hotel FROM "Room" WHERE "id" = NEW."roomId";
    WHEN 'MaintenanceRequest' THEN
      SELECT "hotelId" INTO linked_hotel FROM "Room" WHERE "id" = NEW."roomId";
    WHEN 'Payment' THEN
      SELECT "hotelId" INTO linked_hotel FROM "PaymentMethod" WHERE "id" = NEW."paymentMethodId";
    ELSE
      RAISE EXCEPTION 'unsupported tenant-link table: %', TG_TABLE_NAME;
  END CASE;

  IF linked_hotel IS NULL OR linked_hotel <> NEW."hotelId" THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = TG_TABLE_NAME || ' contains a cross-hotel reference';
  END IF;
  RETURN NEW;
END;
$$;
