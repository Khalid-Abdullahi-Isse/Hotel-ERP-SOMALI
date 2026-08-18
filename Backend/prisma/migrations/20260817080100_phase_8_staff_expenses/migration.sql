-- Combined cashier/reception/housekeeping STAFF may post and view daily expenses.
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id" FROM "Role" r CROSS JOIN "Permission" p
WHERE r."isSystem"=true AND r."name"='STAFF' AND p."key" IN ('expense.create','expense.view')
ON CONFLICT DO NOTHING;
