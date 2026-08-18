-- Keep room configuration consistent with active reservation assignments even
-- when writes bypass NestJS.

CREATE OR REPLACE FUNCTION enforce_reservation_room_integrity()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  reservation_hotel uuid;
  reservation_status "ReservationStatus";
  reservation_check_in date;
  reservation_check_out date;
  room_hotel uuid;
  room_active boolean;
  room_status "RoomStatus";
BEGIN
  SELECT "hotelId", "status", "checkInDate", "checkOutDate"
    INTO reservation_hotel, reservation_status, reservation_check_in, reservation_check_out
    FROM "Reservation" WHERE "id" = NEW."reservationId" FOR KEY SHARE;
  SELECT "hotelId", "isActive", "status"
    INTO room_hotel, room_active, room_status
    FROM "Room" WHERE "id" = NEW."roomId" FOR KEY SHARE;

  IF reservation_hotel IS NULL OR room_hotel IS NULL OR reservation_hotel <> room_hotel THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'reservation and room must belong to the same hotel';
  END IF;
  IF NOT room_active OR room_status = 'MAINTENANCE' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'reservation requires an active room not under maintenance';
  END IF;

  NEW."bookingStatus" := reservation_status;
  NEW."checkInDate" := reservation_check_in;
  NEW."checkOutDate" := reservation_check_out;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION protect_booked_room_configuration()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NOT NEW."isActive" OR NEW."status" = 'MAINTENANCE')
     AND EXISTS (
       SELECT 1 FROM "ReservationRoom"
       WHERE "roomId" = NEW."id"
         AND "bookingStatus" IN ('PENDING', 'CONFIRMED', 'CHECKED_IN')
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'room has active reservations';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Room_protect_active_bookings"
BEFORE UPDATE OF "isActive", "status" ON "Room"
FOR EACH ROW EXECUTE FUNCTION protect_booked_room_configuration();
