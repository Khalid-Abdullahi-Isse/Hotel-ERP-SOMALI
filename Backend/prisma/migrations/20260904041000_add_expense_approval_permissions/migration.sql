-- Adds expense approval, rejection and payment permissions for the
-- expense approval workflow. ADMIN and MANAGER may approve/reject/pay.
INSERT INTO "Permission" ("id", "key", "description")
VALUES
  (gen_random_uuid(), 'expense.approve', 'Approve a submitted hotel expense'),
  (gen_random_uuid(), 'expense.reject', 'Reject a submitted hotel expense'),
  (gen_random_uuid(), 'expense.pay', 'Mark an approved expense as paid')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id" FROM "Role" r CROSS JOIN "Permission" p
WHERE r."isSystem" = true
  AND r."name" IN ('ADMIN', 'MANAGER')
  AND p."key" IN ('expense.approve', 'expense.reject', 'expense.pay')
ON CONFLICT DO NOTHING;
