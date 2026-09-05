-- Maintenance request workflow: richer status lifecycle, priority, category,
-- and optional expense integration. This migration is fully idempotent so it
-- can complete cleanly even after a partially-applied earlier attempt.
-- The legacy DONE status is mapped onto the new COMPLETED lifecycle.

-- 1. Extend MaintenanceStatus with the new lifecycle states (idempotent).
DO $$
DECLARE
  val text;
  vals text[] := ARRAY['ASSIGNED','ON_HOLD','COMPLETED','VERIFIED','CLOSED','CANCELLED'];
BEGIN
  FOREACH val IN ARRAY vals LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                   WHERE t.typname = 'MaintenanceStatus' AND e.enumlabel = val) THEN
      EXECUTE format('ALTER TYPE "MaintenanceStatus" ADD VALUE IF NOT EXISTS %L', val);
    END IF;
  END LOOP;
END $$;

-- 2. MaintenancePriority enum (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MaintenancePriority') THEN
    CREATE TYPE "MaintenancePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
  END IF;
END $$;

-- 3. Add lifecycle columns to MaintenanceRequest (idempotent).
ALTER TABLE "MaintenanceRequest" ADD COLUMN IF NOT EXISTS "category" VARCHAR(100);
ALTER TABLE "MaintenanceRequest" ADD COLUMN IF NOT EXISTS "priority" "MaintenancePriority" NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "MaintenanceRequest" ADD COLUMN IF NOT EXISTS "assignedAt" TIMESTAMPTZ(3);
ALTER TABLE "MaintenanceRequest" ADD COLUMN IF NOT EXISTS "heldAt" TIMESTAMPTZ(3);
ALTER TABLE "MaintenanceRequest" ADD COLUMN IF NOT EXISTS "resumedAt" TIMESTAMPTZ(3);
ALTER TABLE "MaintenanceRequest" ADD COLUMN IF NOT EXISTS "completedById" UUID;
ALTER TABLE "MaintenanceRequest" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMPTZ(3);
ALTER TABLE "MaintenanceRequest" ADD COLUMN IF NOT EXISTS "verifiedById" UUID;
ALTER TABLE "MaintenanceRequest" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMPTZ(3);
ALTER TABLE "MaintenanceRequest" ADD COLUMN IF NOT EXISTS "closedById" UUID;
ALTER TABLE "MaintenanceRequest" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMPTZ(3);
ALTER TABLE "MaintenanceRequest" ADD COLUMN IF NOT EXISTS "cancelledById" UUID;
ALTER TABLE "MaintenanceRequest" ADD COLUMN IF NOT EXISTS "cancelReason" VARCHAR(500);

-- 3a. Remap any remaining legacy DONE rows onto the new lifecycle.
-- The old phase-7 trigger guarded OPEN->IN_PROGRESS and IN_PROGRESS->DONE only,
-- and the MaintenanceRequest_timestamps CHECK only allowed OPEN/IN_PROGRESS/DONE.
-- Both stale DB-level guards are dropped; lifecycle is enforced app-side.
DROP TRIGGER IF EXISTS "MaintenanceRequest_integrity" ON "MaintenanceRequest";
DROP TRIGGER IF EXISTS "Maintenance_tenant_links" ON "MaintenanceRequest";
ALTER TABLE "MaintenanceRequest" DROP CONSTRAINT IF EXISTS "MaintenanceRequest_timestamps";

UPDATE "MaintenanceRequest"
SET "status" = 'COMPLETED',
    "completedAt" = COALESCE("completedAt", now())
WHERE "status" = 'DONE';

-- 3b. Tenant-integrity trigger (no restrictive transition guard; transitions are
-- enforced in the application layer).
CREATE OR REPLACE FUNCTION enforce_maintenance_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  linked_hotel UUID;
BEGIN
  IF NEW."roomId" IS NOT NULL THEN
    SELECT "hotelId" INTO linked_hotel FROM "Room" WHERE "id" = NEW."roomId";
    IF linked_hotel IS NULL OR linked_hotel <> NEW."hotelId" THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invalid maintenance room';
    END IF;
  END IF;
  IF NEW."assignedToId" IS NOT NULL THEN
    SELECT "hotelId" INTO linked_hotel FROM "User" WHERE "id" = NEW."assignedToId";
    IF linked_hotel IS NULL OR linked_hotel <> NEW."hotelId" THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invalid maintenance assignee';
    END IF;
  END IF;
  IF NEW."createdById" IS NOT NULL THEN
    SELECT "hotelId" INTO linked_hotel FROM "User" WHERE "id" = NEW."createdById";
    IF linked_hotel IS NULL OR linked_hotel <> NEW."hotelId" THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invalid maintenance creator';
    END IF;
  END IF;
  IF NEW."completedById" IS NOT NULL THEN
    SELECT "hotelId" INTO linked_hotel FROM "User" WHERE "id" = NEW."completedById";
    IF linked_hotel IS NULL OR linked_hotel <> NEW."hotelId" THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invalid maintenance completer';
    END IF;
  END IF;
  IF NEW."verifiedById" IS NOT NULL THEN
    SELECT "hotelId" INTO linked_hotel FROM "User" WHERE "id" = NEW."verifiedById";
    IF linked_hotel IS NULL OR linked_hotel <> NEW."hotelId" THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invalid maintenance verifier';
    END IF;
  END IF;
  IF NEW."closedById" IS NOT NULL THEN
    SELECT "hotelId" INTO linked_hotel FROM "User" WHERE "id" = NEW."closedById";
    IF linked_hotel IS NULL OR linked_hotel <> NEW."hotelId" THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invalid maintenance closer';
    END IF;
  END IF;
  IF NEW."cancelledById" IS NOT NULL THEN
    SELECT "hotelId" INTO linked_hotel FROM "User" WHERE "id" = NEW."cancelledById";
    IF linked_hotel IS NULL OR linked_hotel <> NEW."hotelId" THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invalid maintenance canceller';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER "MaintenanceRequest_integrity" BEFORE INSERT OR UPDATE ON "MaintenanceRequest"
FOR EACH ROW EXECUTE FUNCTION enforce_maintenance_integrity();

-- 3c. Indexes for the workflow queries (idempotent).
CREATE INDEX IF NOT EXISTS "MaintenanceRequest_hotelId_status_createdAt_idx" ON "MaintenanceRequest"("hotelId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "MaintenanceRequest_roomId_status_idx" ON "MaintenanceRequest"("roomId", "status");
CREATE INDEX IF NOT EXISTS "MaintenanceRequest_assignedToId_status_idx" ON "MaintenanceRequest"("assignedToId", "status");
CREATE INDEX IF NOT EXISTS "MaintenanceRequest_completedById_idx" ON "MaintenanceRequest"("completedById");
CREATE INDEX IF NOT EXISTS "MaintenanceRequest_verifiedById_idx" ON "MaintenanceRequest"("verifiedById");
CREATE INDEX IF NOT EXISTS "MaintenanceRequest_closedById_idx" ON "MaintenanceRequest"("closedById");
CREATE INDEX IF NOT EXISTS "MaintenanceRequest_cancelledById_idx" ON "MaintenanceRequest"("cancelledById");

-- 4. Expense integration: nullable unique link to a maintenance request (idempotent).
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "maintenanceId" UUID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Expense_maintenanceId_key' AND conrelid = '"Expense"'::regclass) THEN
    ALTER TABLE "Expense" ADD CONSTRAINT "Expense_maintenanceId_key" UNIQUE ("maintenanceId");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Expense_maintenanceId_fkey' AND conrelid = '"Expense"'::regclass) THEN
    ALTER TABLE "Expense" ADD CONSTRAINT "Expense_maintenanceId_fkey"
      FOREIGN KEY ("maintenanceId") REFERENCES "MaintenanceRequest"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Expense_maintenanceId_idx" ON "Expense"("maintenanceId");

-- 5. Update the expense integrity trigger to validate the maintenance link tenant.
CREATE OR REPLACE FUNCTION enforce_expense_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  linked_hotel uuid;
BEGIN
  SELECT "hotelId" INTO linked_hotel FROM "ExpenseCategory"
    WHERE "id"=NEW."categoryId" AND (TG_OP='UPDATE' OR "isActive"=true);
  IF linked_hotel IS NULL OR linked_hotel <> NEW."hotelId" THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invalid expense category'; END IF;
  IF NEW."paymentMethodId" IS NOT NULL THEN
    SELECT "hotelId" INTO linked_hotel FROM "PaymentMethod"
      WHERE "id"=NEW."paymentMethodId" AND (TG_OP='UPDATE' OR "isActive"=true);
    IF linked_hotel IS NULL OR linked_hotel <> NEW."hotelId" THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invalid expense payment method'; END IF;
  END IF;
  SELECT "hotelId" INTO linked_hotel FROM "User" WHERE "id"=NEW."createdById";
  IF linked_hotel IS NULL OR linked_hotel <> NEW."hotelId" THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invalid expense creator'; END IF;
  IF NEW."approvedById" IS NOT NULL THEN
    SELECT "hotelId" INTO linked_hotel FROM "User" WHERE "id" = NEW."approvedById";
    IF linked_hotel IS NULL OR linked_hotel <> NEW."hotelId" THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invalid expense approver'; END IF;
  END IF;
  IF NEW."paidById" IS NOT NULL THEN
    SELECT "hotelId" INTO linked_hotel FROM "User" WHERE "id" = NEW."paidById";
    IF linked_hotel IS NULL OR linked_hotel <> NEW."hotelId" THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invalid expense payer'; END IF;
  END IF;
  IF NEW."rejectedById" IS NOT NULL THEN
    SELECT "hotelId" INTO linked_hotel FROM "User" WHERE "id" = NEW."rejectedById";
    IF linked_hotel IS NULL OR linked_hotel <> NEW."hotelId" THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invalid expense rejecter'; END IF;
  END IF;
  IF NEW."reversedById" IS NOT NULL THEN
    SELECT "hotelId" INTO linked_hotel FROM "User" WHERE "id" = NEW."reversedById";
    IF linked_hotel IS NULL OR linked_hotel <> NEW."hotelId" THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invalid expense reverser'; END IF;
  END IF;
  IF NEW."maintenanceId" IS NOT NULL THEN
    SELECT "hotelId" INTO linked_hotel FROM "MaintenanceRequest" WHERE "id" = NEW."maintenanceId";
    IF linked_hotel IS NULL OR linked_hotel <> NEW."hotelId" THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invalid expense maintenance link'; END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS "Expense_integrity" ON "Expense";
CREATE TRIGGER "Expense_integrity" BEFORE INSERT OR UPDATE ON "Expense"
FOR EACH ROW EXECUTE FUNCTION enforce_expense_integrity();
