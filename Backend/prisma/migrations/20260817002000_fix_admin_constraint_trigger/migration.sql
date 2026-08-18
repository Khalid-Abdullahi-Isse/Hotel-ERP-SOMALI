-- PostgreSQL resolves fields in a polymorphic trigger record eagerly inside a
-- CASE expression. Use control-flow branches so User rows never access userId.
CREATE OR REPLACE FUNCTION ensure_hotel_has_active_admin()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE affected_user uuid;
DECLARE affected_hotel uuid;
DECLARE admin_role_exists boolean;
DECLARE active_admins integer;
BEGIN
  IF TG_TABLE_NAME = 'UserRole' THEN
    affected_user := OLD."userId";
  ELSE
    affected_user := OLD."id";
  END IF;

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
