-- Phase 7: checkout housekeeping handoff and safe maintenance workflows.
ALTER TABLE "HousekeepingTask" ADD COLUMN "reservationId" UUID;
ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "HousekeepingTask_reservationId_roomId_key" ON "HousekeepingTask"("reservationId", "roomId");
CREATE UNIQUE INDEX "HousekeepingTask_one_active_per_room" ON "HousekeepingTask"("roomId") WHERE "status" IN ('DIRTY','CLEANING');
ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_timestamps" CHECK (
  ("status"='DIRTY' AND "startedAt" IS NULL AND "completedAt" IS NULL)
  OR ("status"='CLEANING' AND "startedAt" IS NOT NULL AND "completedAt" IS NULL)
  OR ("status"='COMPLETED' AND "startedAt" IS NOT NULL AND "completedAt" IS NOT NULL AND "completedAt">="startedAt")
);

ALTER TABLE "MaintenanceRequest" ADD COLUMN "createdById" UUID, ADD COLUMN "startedAt" TIMESTAMPTZ(3), ADD COLUMN "previousRoomStatus" "RoomStatus";
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "MaintenanceRequest_createdById_idx" ON "MaintenanceRequest"("createdById");
CREATE UNIQUE INDEX "MaintenanceRequest_one_active_per_room" ON "MaintenanceRequest"("roomId") WHERE "status" IN ('OPEN','IN_PROGRESS');
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_timestamps" CHECK (
  ("status"='OPEN' AND "startedAt" IS NULL AND "completedAt" IS NULL AND "previousRoomStatus" IS NULL)
  OR ("status"='IN_PROGRESS' AND "startedAt" IS NOT NULL AND "completedAt" IS NULL AND "previousRoomStatus" IS NOT NULL)
  OR ("status"='DONE' AND "startedAt" IS NOT NULL AND "completedAt" IS NOT NULL AND "previousRoomStatus" IS NOT NULL AND "completedAt">="startedAt")
);

CREATE OR REPLACE FUNCTION enforce_housekeeping_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE linked_hotel uuid;
BEGIN
  SELECT "hotelId" INTO linked_hotel FROM "Room" WHERE "id"=NEW."roomId";
  IF linked_hotel IS NULL OR linked_hotel<>NEW."hotelId" THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invalid housekeeping room'; END IF;
  IF NEW."assignedToId" IS NOT NULL THEN SELECT "hotelId" INTO linked_hotel FROM "User" WHERE "id"=NEW."assignedToId"; IF linked_hotel IS NULL OR linked_hotel<>NEW."hotelId" THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invalid housekeeping assignee'; END IF; END IF;
  IF NEW."reservationId" IS NOT NULL THEN SELECT r."hotelId" INTO linked_hotel FROM "Reservation" r JOIN "ReservationRoom" rr ON rr."reservationId"=r."id" WHERE r."id"=NEW."reservationId" AND rr."roomId"=NEW."roomId"; IF linked_hotel IS NULL OR linked_hotel<>NEW."hotelId" THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invalid housekeeping reservation'; END IF; END IF;
  IF TG_OP='UPDATE' AND NOT ((OLD."status"='DIRTY' AND NEW."status" IN ('DIRTY','CLEANING')) OR (OLD."status"='CLEANING' AND NEW."status" IN ('CLEANING','COMPLETED')) OR OLD."status"=NEW."status") THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invalid housekeeping transition'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER "HousekeepingTask_tenant_links" ON "HousekeepingTask";
CREATE TRIGGER "HousekeepingTask_integrity" BEFORE INSERT OR UPDATE ON "HousekeepingTask" FOR EACH ROW EXECUTE FUNCTION enforce_housekeeping_integrity();

CREATE OR REPLACE FUNCTION enforce_maintenance_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE linked_hotel uuid;
BEGIN
  SELECT "hotelId" INTO linked_hotel FROM "Room" WHERE "id"=NEW."roomId";
  IF linked_hotel IS NULL OR linked_hotel<>NEW."hotelId" THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invalid maintenance room'; END IF;
  IF NEW."assignedToId" IS NOT NULL THEN SELECT "hotelId" INTO linked_hotel FROM "User" WHERE "id"=NEW."assignedToId"; IF linked_hotel IS NULL OR linked_hotel<>NEW."hotelId" THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invalid maintenance assignee'; END IF; END IF;
  IF NEW."createdById" IS NOT NULL THEN SELECT "hotelId" INTO linked_hotel FROM "User" WHERE "id"=NEW."createdById"; IF linked_hotel IS NULL OR linked_hotel<>NEW."hotelId" THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invalid maintenance creator'; END IF; END IF;
  IF TG_OP='UPDATE' AND NOT ((OLD."status"='OPEN' AND NEW."status" IN ('OPEN','IN_PROGRESS')) OR (OLD."status"='IN_PROGRESS' AND NEW."status" IN ('IN_PROGRESS','DONE')) OR OLD."status"=NEW."status") THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invalid maintenance transition'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER "MaintenanceRequest_tenant_links" ON "MaintenanceRequest";
CREATE TRIGGER "MaintenanceRequest_integrity" BEFORE INSERT OR UPDATE ON "MaintenanceRequest" FOR EACH ROW EXECUTE FUNCTION enforce_maintenance_integrity();
