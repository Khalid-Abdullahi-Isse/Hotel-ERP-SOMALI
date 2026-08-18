-- Phase 8: reporting access paths and reversal compatibility with inactive catalogs.
CREATE INDEX "Payment_hotelId_status_paidAt_idx" ON "Payment"("hotelId", "status", "paidAt");
CREATE INDEX "Expense_hotelId_reversedAt_expenseDate_idx" ON "Expense"("hotelId", "reversedAt", "expenseDate");

CREATE OR REPLACE FUNCTION enforce_expense_integrity()
RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE linked_hotel uuid; BEGIN
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
  IF NEW."reversedById" IS NOT NULL THEN
    SELECT "hotelId" INTO linked_hotel FROM "User" WHERE "id"=NEW."reversedById";
    IF linked_hotel IS NULL OR linked_hotel <> NEW."hotelId" THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invalid expense reverser'; END IF;
  END IF;
  RETURN NEW;
END; $$;
