-- Ensure every existing STAFF system role can use the complete Front Desk
-- workflow, even if its permissions were customized before this release.
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."isSystem" = true
  AND r."name" = 'STAFF'
  AND p."key" IN (
    'dashboard.view',
    'room.view',
    'guest.create',
    'guest.view',
    'guest.update',
    'reservation.create',
    'reservation.view',
    'reservation.update',
    'reservation.confirm',
    'reservation.cancel',
    'availability.view',
    'check_in.create',
    'check_out.create',
    'charge.create',
    'charge.view',
    'payment.create',
    'payment.view'
  )
ON CONFLICT DO NOTHING;
