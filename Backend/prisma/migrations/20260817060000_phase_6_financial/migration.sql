-- Phase 6: immutable payments/refunds, issued invoices, and reversible expenses.

INSERT INTO "Permission" ("id", "key", "description") VALUES
  (gen_random_uuid(), 'payment_method.manage', 'Configure hotel payment methods'),
  (gen_random_uuid(), 'invoice.void', 'Void an unpaid invoice with a reason'),
  (gen_random_uuid(), 'expense_category.manage', 'Configure expense categories'),
  (gen_random_uuid(), 'expense.reverse', 'Reverse a posted expense with a reason')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id" FROM "Role" r CROSS JOIN "Permission" p
WHERE r."isSystem" = true
  AND r."name" IN ('ADMIN', 'MANAGER')
  AND p."key" IN ('payment_method.manage', 'invoice.void', 'expense_category.manage', 'expense.reverse')
ON CONFLICT DO NOTHING;

ALTER TABLE "Payment" ADD COLUMN "requestKey" UUID;
UPDATE "Payment" SET "requestKey" = gen_random_uuid() WHERE "requestKey" IS NULL;
ALTER TABLE "Payment" ALTER COLUMN "requestKey" SET NOT NULL;
CREATE UNIQUE INDEX "Payment_hotelId_requestKey_key" ON "Payment"("hotelId", "requestKey");

ALTER TABLE "Invoice"
  ADD COLUMN "issuedById" UUID,
  ADD COLUMN "voidedAt" TIMESTAMPTZ(3),
  ADD COLUMN "voidedById" UUID,
  ADD COLUMN "voidReason" VARCHAR(500);
CREATE INDEX "Invoice_issuedById_idx" ON "Invoice"("issuedById");
CREATE INDEX "Invoice_voidedById_idx" ON "Invoice"("voidedById");
ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Invoice_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Invoice_issue_complete" CHECK (
    ("status" = 'DRAFT' AND "issuedAt" IS NULL)
    OR ("status" <> 'DRAFT' AND "issuedAt" IS NOT NULL)
  ),
  ADD CONSTRAINT "Invoice_void_complete" CHECK (
    ("status" <> 'VOIDED' AND "voidedAt" IS NULL AND "voidedById" IS NULL AND "voidReason" IS NULL)
    OR ("status" = 'VOIDED' AND "voidedAt" IS NOT NULL AND "voidedById" IS NOT NULL AND coalesce(btrim("voidReason"), '') <> '')
  );

CREATE UNIQUE INDEX "InvoiceItem_chargeId_key" ON "InvoiceItem"("chargeId");
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_amount_math" CHECK ("amount" = "quantity" * "unitPrice");

ALTER TABLE "Expense" ADD COLUMN "requestKey" UUID, ADD COLUMN "reversedById" UUID;
UPDATE "Expense" SET "requestKey" = gen_random_uuid() WHERE "requestKey" IS NULL;
ALTER TABLE "Expense" ALTER COLUMN "requestKey" SET NOT NULL;
CREATE UNIQUE INDEX "Expense_hotelId_requestKey_key" ON "Expense"("hotelId", "requestKey");
CREATE INDEX "Expense_reversedById_idx" ON "Expense"("reversedById");
ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  DROP CONSTRAINT "Expense_reversal_complete",
  ADD CONSTRAINT "Expense_reversal_complete" CHECK (
    ("reversedAt" IS NULL AND "reversedById" IS NULL AND "reversalReason" IS NULL)
    OR ("reversedAt" IS NOT NULL AND "reversedById" IS NOT NULL AND coalesce(btrim("reversalReason"), '') <> '')
  );

CREATE OR REPLACE FUNCTION enforce_payment_integrity()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE linked_hotel uuid;
DECLARE original_amount numeric(14,2);
DECLARE refunded_amount numeric(14,2);
DECLARE original_hotel uuid;
DECLARE original_kind "PaymentKind";
BEGIN
  SELECT "hotelId" INTO linked_hotel FROM "PaymentMethod" WHERE "id" = NEW."paymentMethodId" AND "isActive" = true;
  IF linked_hotel IS NULL OR linked_hotel <> NEW."hotelId" THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invalid payment method'; END IF;
  SELECT "hotelId" INTO linked_hotel FROM "User" WHERE "id" = NEW."createdById";
  IF linked_hotel IS NULL OR linked_hotel <> NEW."hotelId" THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invalid payment creator'; END IF;
  IF NEW."reservationId" IS NOT NULL THEN
    SELECT "hotelId" INTO linked_hotel FROM "Reservation" WHERE "id" = NEW."reservationId";
    IF linked_hotel IS NULL OR linked_hotel <> NEW."hotelId" THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invalid payment reservation'; END IF;
  END IF;
  IF NEW."invoiceId" IS NOT NULL THEN
    SELECT "hotelId" INTO linked_hotel FROM "Invoice" WHERE "id" = NEW."invoiceId" AND "reservationId" IS NOT DISTINCT FROM NEW."reservationId";
    IF linked_hotel IS NULL OR linked_hotel <> NEW."hotelId" THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invalid payment invoice'; END IF;
  END IF;
  IF NEW."guestId" IS NOT NULL THEN
    SELECT "hotelId" INTO linked_hotel FROM "Guest" WHERE "id" = NEW."guestId";
    IF linked_hotel IS NULL OR linked_hotel <> NEW."hotelId" THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invalid payment guest'; END IF;
  END IF;
  IF NEW."kind" = 'REFUND' THEN
    SELECT "amount", "hotelId", "kind" INTO original_amount, original_hotel, original_kind
      FROM "Payment" WHERE "id" = NEW."originalPaymentId" FOR UPDATE;
    IF original_hotel IS NULL OR original_hotel <> NEW."hotelId" OR original_kind <> 'PAYMENT' THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invalid original payment';
    END IF;
    SELECT coalesce(sum("amount"), 0) INTO refunded_amount FROM "Payment"
      WHERE "originalPaymentId" = NEW."originalPaymentId" AND "kind" = 'REFUND' AND "status" = 'COMPLETED';
    IF refunded_amount + NEW."amount" > original_amount THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='refund exceeds original payment';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER "Payment_tenant_links" ON "Payment";
CREATE TRIGGER "Payment_integrity" BEFORE INSERT ON "Payment" FOR EACH ROW EXECUTE FUNCTION enforce_payment_integrity();

CREATE OR REPLACE FUNCTION prevent_payment_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='payments and refunds are immutable';
END; $$;
CREATE TRIGGER "Payment_immutable" BEFORE UPDATE OR DELETE ON "Payment" FOR EACH ROW EXECUTE FUNCTION prevent_payment_mutation();

CREATE OR REPLACE FUNCTION enforce_invoice_integrity()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE linked_hotel uuid; DECLARE reservation_status "ReservationStatus"; DECLARE item_total numeric(14,2); DECLARE net_paid numeric(14,2);
BEGIN
  SELECT "hotelId", "status" INTO linked_hotel, reservation_status FROM "Reservation" WHERE "id" = NEW."reservationId";
  IF linked_hotel IS NULL OR linked_hotel <> NEW."hotelId" OR reservation_status <> 'CHECKED_OUT' THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invoice requires a checked-out reservation in the same hotel';
  END IF;
  IF NEW."issuedById" IS NOT NULL THEN
    SELECT "hotelId" INTO linked_hotel FROM "User" WHERE "id" = NEW."issuedById";
    IF linked_hotel IS NULL OR linked_hotel <> NEW."hotelId" THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invalid invoice issuer'; END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."status" = 'DRAFT' AND NEW."status" <> 'DRAFT' THEN
    SELECT coalesce(sum("amount"),0) INTO item_total FROM "InvoiceItem" WHERE "invoiceId" = NEW."id";
    IF item_total <> NEW."subtotal" THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invoice subtotal does not match items'; END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW."status" = 'VOIDED' THEN
    SELECT coalesce(sum(CASE WHEN "kind"='PAYMENT' THEN "amount" ELSE -"amount" END),0) INTO net_paid
      FROM "Payment" WHERE "reservationId" = NEW."reservationId" AND "status"='COMPLETED';
    IF net_paid <> 0 THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='paid invoice cannot be voided'; END IF;
    SELECT "hotelId" INTO linked_hotel FROM "User" WHERE "id" = NEW."voidedById";
    IF linked_hotel IS NULL OR linked_hotel <> NEW."hotelId" THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invalid invoice voider'; END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER "Invoice_tenant_links" ON "Invoice";
CREATE TRIGGER "Invoice_integrity" BEFORE INSERT OR UPDATE ON "Invoice" FOR EACH ROW EXECUTE FUNCTION enforce_invoice_integrity();

CREATE OR REPLACE FUNCTION protect_invoice_financials()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='invoices cannot be deleted'; END IF;
  IF OLD."status" <> 'DRAFT' AND (
    NEW."hotelId" IS DISTINCT FROM OLD."hotelId" OR NEW."reservationId" IS DISTINCT FROM OLD."reservationId"
    OR NEW."invoiceNumber" IS DISTINCT FROM OLD."invoiceNumber" OR NEW."subtotal" IS DISTINCT FROM OLD."subtotal"
    OR NEW."discountAmount" IS DISTINCT FROM OLD."discountAmount" OR NEW."totalAmount" IS DISTINCT FROM OLD."totalAmount"
    OR NEW."issuedAt" IS DISTINCT FROM OLD."issuedAt" OR NEW."issuedById" IS DISTINCT FROM OLD."issuedById") THEN
    RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='issued invoice financial fields are immutable';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "Invoice_financials" BEFORE UPDATE OR DELETE ON "Invoice" FOR EACH ROW EXECUTE FUNCTION protect_invoice_financials();

CREATE OR REPLACE FUNCTION enforce_invoice_item_integrity()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE invoice_status "InvoiceStatus"; DECLARE invoice_reservation uuid; DECLARE linked_reservation uuid; DECLARE is_voided timestamptz;
BEGIN
  SELECT "status", "reservationId" INTO invoice_status, invoice_reservation FROM "Invoice" WHERE "id"=NEW."invoiceId" FOR KEY SHARE;
  IF invoice_status <> 'DRAFT' THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invoice items require a draft invoice'; END IF;
  SELECT "reservationId", "voidedAt" INTO linked_reservation, is_voided FROM "Charge" WHERE "id"=NEW."chargeId" FOR KEY SHARE;
  IF linked_reservation IS NULL OR linked_reservation <> invoice_reservation OR is_voided IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invalid invoice charge';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "InvoiceItem_integrity" BEFORE INSERT ON "InvoiceItem" FOR EACH ROW EXECUTE FUNCTION enforce_invoice_item_integrity();
CREATE OR REPLACE FUNCTION protect_invoice_item_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE invoice_status "InvoiceStatus"; BEGIN
  SELECT "status" INTO invoice_status FROM "Invoice" WHERE "id"=OLD."invoiceId";
  IF invoice_status <> 'DRAFT' THEN RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='issued invoice items are immutable'; END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END; $$;
CREATE TRIGGER "InvoiceItem_immutable" BEFORE UPDATE OR DELETE ON "InvoiceItem" FOR EACH ROW EXECUTE FUNCTION protect_invoice_item_mutation();

CREATE OR REPLACE FUNCTION enforce_expense_integrity()
RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE linked_hotel uuid; BEGIN
  SELECT "hotelId" INTO linked_hotel FROM "ExpenseCategory" WHERE "id"=NEW."categoryId" AND "isActive"=true;
  IF linked_hotel IS NULL OR linked_hotel <> NEW."hotelId" THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invalid expense category'; END IF;
  IF NEW."paymentMethodId" IS NOT NULL THEN
    SELECT "hotelId" INTO linked_hotel FROM "PaymentMethod" WHERE "id"=NEW."paymentMethodId" AND "isActive"=true;
    IF linked_hotel IS NULL OR linked_hotel <> NEW."hotelId" THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invalid expense payment method'; END IF;
  END IF;
  SELECT "hotelId" INTO linked_hotel FROM "User" WHERE "id"=NEW."createdById";
  IF linked_hotel IS NULL OR linked_hotel <> NEW."hotelId" THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invalid expense creator'; END IF;
  IF NEW."reversedById" IS NOT NULL THEN
    SELECT "hotelId" INTO linked_hotel FROM "User" WHERE "id"=NEW."reversedById";
    IF linked_hotel IS NULL OR linked_hotel <> NEW."hotelId" THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invalid expense reverser'; END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER "Expense_tenant_links" ON "Expense";
CREATE TRIGGER "Expense_integrity" BEFORE INSERT OR UPDATE ON "Expense" FOR EACH ROW EXECUTE FUNCTION enforce_expense_integrity();
CREATE OR REPLACE FUNCTION protect_expense_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='expenses cannot be deleted'; END IF;
  IF OLD."reversedAt" IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='reversed expenses cannot be changed'; END IF;
  IF NEW."hotelId" IS DISTINCT FROM OLD."hotelId" OR NEW."categoryId" IS DISTINCT FROM OLD."categoryId"
     OR NEW."paymentMethodId" IS DISTINCT FROM OLD."paymentMethodId" OR NEW."createdById" IS DISTINCT FROM OLD."createdById"
     OR NEW."requestKey" IS DISTINCT FROM OLD."requestKey" OR NEW."amount" IS DISTINCT FROM OLD."amount"
     OR NEW."expenseDate" IS DISTINCT FROM OLD."expenseDate" OR NEW."description" IS DISTINCT FROM OLD."description"
     OR NEW."reference" IS DISTINCT FROM OLD."reference" THEN
    RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='posted expense financial fields are immutable';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "Expense_immutable" BEFORE UPDATE OR DELETE ON "Expense" FOR EACH ROW EXECUTE FUNCTION protect_expense_mutation();
