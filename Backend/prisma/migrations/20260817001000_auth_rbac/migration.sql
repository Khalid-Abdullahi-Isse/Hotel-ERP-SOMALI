-- Phase 2 authentication and RBAC foundation.
-- Refresh tokens were not exposed in Phase 1, so any manually inserted rows are
-- intentionally invalidated rather than migrated into unverifiable sessions.
TRUNCATE TABLE "RefreshToken";

ALTER TABLE "User"
  ADD COLUMN "deletedAt" TIMESTAMPTZ(3);

ALTER TABLE "Role"
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "deletedAt" TIMESTAMPTZ(3);

CREATE TABLE "AuthSession" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "revokedAt" TIMESTAMPTZ(3),
  "revokeReason" VARCHAR(160),
  "createdByIp" INET,
  "userAgent" VARCHAR(512),
  "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AuthSession_expiry_valid" CHECK ("expiresAt" > "createdAt"),
  CONSTRAINT "AuthSession_revocation_complete" CHECK (
    ("revokedAt" IS NULL AND "revokeReason" IS NULL)
    OR ("revokedAt" IS NOT NULL AND btrim("revokeReason") <> '')
  )
);

DROP INDEX "RefreshToken_userId_expiresAt_idx";
ALTER TABLE "RefreshToken" DROP CONSTRAINT "RefreshToken_userId_fkey";
ALTER TABLE "RefreshToken"
  DROP COLUMN "userId",
  ADD COLUMN "sessionId" UUID NOT NULL,
  ADD COLUMN "usedAt" TIMESTAMPTZ(3),
  ALTER COLUMN "tokenHash" TYPE CHAR(64);

CREATE INDEX "AuthSession_userId_revokedAt_expiresAt_idx"
  ON "AuthSession"("userId", "revokedAt", "expiresAt");
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");
CREATE INDEX "RefreshToken_sessionId_expiresAt_idx"
  ON "RefreshToken"("sessionId", "expiresAt");
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");
CREATE INDEX "Role_hotelId_isActive_idx" ON "Role"("hotelId", "isActive");

ALTER TABLE "AuthSession"
  ADD CONSTRAINT "AuthSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RefreshToken"
  ADD CONSTRAINT "RefreshToken_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "AuthSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RefreshToken"
  ADD CONSTRAINT "RefreshToken_replacedBy_fkey"
  FOREIGN KEY ("replacedBy") REFERENCES "RefreshToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "User"
  ADD CONSTRAINT "User_deletion_inactive" CHECK ("deletedAt" IS NULL OR "status" = 'INACTIVE');
ALTER TABLE "Role"
  ADD CONSTRAINT "Role_name_canonical" CHECK ("name" = upper(btrim("name")) AND btrim("name") <> ''),
  ADD CONSTRAINT "Role_deletion_inactive" CHECK ("deletedAt" IS NULL OR NOT "isActive");
ALTER TABLE "Permission"
  ADD CONSTRAINT "Permission_key_format" CHECK ("key" ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$');
ALTER TABLE "RefreshToken"
  ADD CONSTRAINT "RefreshToken_hash_format" CHECK ("tokenHash" ~ '^[a-f0-9]{64}$'),
  ADD CONSTRAINT "RefreshToken_expiry_after_creation" CHECK ("expiresAt" > "createdAt");

-- Users may only receive roles owned by their own hotel.
CREATE OR REPLACE FUNCTION enforce_user_role_hotel()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE user_hotel uuid;
DECLARE role_hotel uuid;
DECLARE role_active boolean;
BEGIN
  SELECT "hotelId" INTO user_hotel FROM "User" WHERE "id" = NEW."userId" FOR KEY SHARE;
  SELECT "hotelId", "isActive" INTO role_hotel, role_active
    FROM "Role" WHERE "id" = NEW."roleId" FOR KEY SHARE;

  IF user_hotel IS NULL OR role_hotel IS NULL OR user_hotel <> role_hotel THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'user and role must belong to the same hotel';
  END IF;
  IF NOT role_active THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'inactive roles cannot be assigned';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "UserRole_same_hotel"
BEFORE INSERT OR UPDATE ON "UserRole"
FOR EACH ROW EXECUTE FUNCTION enforce_user_role_hotel();

-- A refresh token cannot outlive its parent seven-day session.
CREATE OR REPLACE FUNCTION enforce_refresh_session_expiry()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE session_expiry timestamptz;
BEGIN
  SELECT "expiresAt" INTO session_expiry FROM "AuthSession"
    WHERE "id" = NEW."sessionId" FOR KEY SHARE;
  IF session_expiry IS NULL OR NEW."expiresAt" > session_expiry THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'refresh token cannot outlive its session';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "RefreshToken_session_expiry"
BEFORE INSERT OR UPDATE ON "RefreshToken"
FOR EACH ROW EXECUTE FUNCTION enforce_refresh_session_expiry();

-- ADMIN, MANAGER and STAFF are permanent system roles. Permissions may be
-- updated by ADMIN, but these role identities cannot be renamed or deactivated.
CREATE OR REPLACE FUNCTION protect_system_role()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD."isSystem" THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'system roles cannot be deleted';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."isSystem" AND (
    NEW."name" IS DISTINCT FROM OLD."name"
    OR NEW."hotelId" IS DISTINCT FROM OLD."hotelId"
    OR NEW."isSystem" IS DISTINCT FROM OLD."isSystem"
    OR NEW."isActive" IS DISTINCT FROM OLD."isActive"
    OR NEW."deletedAt" IS DISTINCT FROM OLD."deletedAt"
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'system role identity cannot be changed';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER "Role_protect_system"
BEFORE UPDATE OR DELETE ON "Role"
FOR EACH ROW EXECUTE FUNCTION protect_system_role();

-- Once a hotel has the ADMIN system role, commits may not leave it without an
-- active, non-deleted administrator. Deferred checking permits role replacement
-- inside one transaction without observing a temporary intermediate state.
CREATE OR REPLACE FUNCTION ensure_hotel_has_active_admin()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE affected_user uuid;
DECLARE affected_hotel uuid;
DECLARE admin_role_exists boolean;
DECLARE active_admins integer;
BEGIN
  affected_user := CASE WHEN TG_TABLE_NAME = 'UserRole' THEN OLD."userId" ELSE OLD."id" END;
  SELECT "hotelId" INTO affected_hotel FROM "User" WHERE "id" = affected_user;
  IF affected_hotel IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT EXISTS(
    SELECT 1 FROM "Role"
    WHERE "hotelId" = affected_hotel AND "name" = 'ADMIN' AND "isSystem" = true
  ) INTO admin_role_exists;
  IF NOT admin_role_exists THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT count(*) INTO active_admins
  FROM "User" u
  JOIN "UserRole" ur ON ur."userId" = u."id"
  JOIN "Role" r ON r."id" = ur."roleId"
  WHERE u."hotelId" = affected_hotel
    AND u."status" = 'ACTIVE'
    AND u."deletedAt" IS NULL
    AND r."name" = 'ADMIN'
    AND r."isSystem" = true
    AND r."isActive" = true;

  IF active_admins = 0 THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'hotel must retain an active administrator';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE CONSTRAINT TRIGGER "UserRole_requires_admin"
AFTER DELETE OR UPDATE ON "UserRole"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION ensure_hotel_has_active_admin();

CREATE CONSTRAINT TRIGGER "User_requires_admin"
AFTER UPDATE OF "status", "deletedAt" ON "User"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
WHEN (NEW."status" = 'INACTIVE' OR NEW."deletedAt" IS NOT NULL)
EXECUTE FUNCTION ensure_hotel_has_active_admin();
