-- Double-entry accounting foundation. Operational records are deliberately not
-- backfilled: a finance administrator must establish an opening ledger first.
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');
CREATE TYPE "NormalBalance" AS ENUM ('DEBIT', 'CREDIT');
CREATE TYPE "AccountingJournalType" AS ENUM ('GENERAL', 'SALES', 'CASH', 'BANK', 'MOBILE_MONEY', 'PURCHASE', 'ADJUSTMENT', 'NIGHT_AUDIT');
CREATE TYPE "JournalEntryStatus" AS ENUM ('DRAFT', 'POSTED', 'REVERSED');

CREATE TABLE "Account" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "hotelId" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "type" "AccountType" NOT NULL,
  "subType" VARCHAR(64),
  "normalBalance" "NormalBalance" NOT NULL,
  "parentAccountId" UUID,
  "currency" CHAR(3) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "allowManualPosting" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Account_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Account_code_not_blank" CHECK (btrim("code") <> ''),
  CONSTRAINT "Account_name_not_blank" CHECK (btrim("name") <> ''),
  CONSTRAINT "Account_currency_format" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "Account_not_own_parent" CHECK ("parentAccountId" IS NULL OR "parentAccountId" <> "id")
);

CREATE TABLE "AccountingJournal" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "hotelId" UUID NOT NULL,
  "code" VARCHAR(24) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "type" "AccountingJournalType" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "AccountingJournal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AccountingJournal_code_not_blank" CHECK (btrim("code") <> ''),
  CONSTRAINT "AccountingJournal_name_not_blank" CHECK (btrim("name") <> '')
);

CREATE TABLE "JournalEntry" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "hotelId" UUID NOT NULL,
  "journalId" UUID NOT NULL,
  "entryNumber" VARCHAR(40) NOT NULL,
  "businessDate" DATE NOT NULL,
  "postingDate" TIMESTAMPTZ(3) NOT NULL,
  "sourceType" VARCHAR(64) NOT NULL,
  "sourceId" UUID,
  "reference" VARCHAR(120),
  "description" VARCHAR(255) NOT NULL,
  "status" "JournalEntryStatus" NOT NULL DEFAULT 'DRAFT',
  "createdById" UUID NOT NULL,
  "postedById" UUID,
  "postedAt" TIMESTAMPTZ(3),
  "reversedEntryId" UUID,
  "reversalEntryId" UUID,
  "reversalReason" VARCHAR(500),
  "reversedById" UUID,
  "reversedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JournalEntry_description_not_blank" CHECK (btrim("description") <> ''),
  CONSTRAINT "JournalEntry_posting_state" CHECK (
    ("status" = 'DRAFT' AND "postedById" IS NULL AND "postedAt" IS NULL)
    OR ("status" IN ('POSTED', 'REVERSED') AND "postedById" IS NOT NULL AND "postedAt" IS NOT NULL)
  ),
  CONSTRAINT "JournalEntry_reversal_state" CHECK (
    ("status" <> 'REVERSED' AND "reversalEntryId" IS NULL AND "reversalReason" IS NULL AND "reversedById" IS NULL AND "reversedAt" IS NULL)
    OR ("status" = 'REVERSED' AND "reversalEntryId" IS NOT NULL AND btrim("reversalReason") <> '' AND "reversedById" IS NOT NULL AND "reversedAt" IS NOT NULL)
  )
);

CREATE TABLE "JournalLine" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "journalEntryId" UUID NOT NULL,
  "accountId" UUID NOT NULL,
  "description" VARCHAR(255),
  "debit" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "credit" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "currency" CHAR(3) NOT NULL,
  "exchangeRate" DECIMAL(19,8) NOT NULL DEFAULT 1,
  "sourceType" VARCHAR(64),
  "sourceId" UUID,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JournalLine_amounts_nonnegative" CHECK ("debit" >= 0 AND "credit" >= 0),
  CONSTRAINT "JournalLine_exactly_one_side" CHECK (("debit" > 0 AND "credit" = 0) OR ("credit" > 0 AND "debit" = 0)),
  CONSTRAINT "JournalLine_exchange_rate_positive" CHECK ("exchangeRate" > 0),
  CONSTRAINT "JournalLine_currency_format" CHECK ("currency" ~ '^[A-Z]{3}$')
);

CREATE TABLE "AccountingSettings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "hotelId" UUID NOT NULL,
  "defaultRoomRevenueAccountId" UUID NOT NULL,
  "defaultGuestReceivableAccountId" UUID NOT NULL,
  "defaultCashAccountId" UUID NOT NULL,
  "defaultBankAccountId" UUID NOT NULL,
  "defaultMobileMoneyAccountId" UUID NOT NULL,
  "defaultDepositAccountId" UUID NOT NULL,
  "defaultTaxPayableAccountId" UUID NOT NULL,
  "defaultServiceRevenueAccountId" UUID NOT NULL,
  "defaultDiscountAccountId" UUID NOT NULL,
  "defaultExpenseAccountId" UUID NOT NULL,
  "baseCurrency" CHAR(3) NOT NULL,
  "discountPostingMode" VARCHAR(32) NOT NULL DEFAULT 'CONTRA_REVENUE',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "AccountingSettings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AccountingSettings_currency_format" CHECK ("baseCurrency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "AccountingSettings_discount_mode" CHECK ("discountPostingMode" IN ('CONTRA_REVENUE', 'REDUCE_REVENUE'))
);

CREATE TABLE "AccountingSequence" (
  "hotelId" UUID NOT NULL,
  "key" VARCHAR(48) NOT NULL,
  "nextValue" BIGINT NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "AccountingSequence_pkey" PRIMARY KEY ("hotelId", "key"),
  CONSTRAINT "AccountingSequence_positive" CHECK ("nextValue" > 0)
);

ALTER TABLE "PaymentMethod" ADD COLUMN "ledgerAccountId" UUID;
ALTER TABLE "Service" ADD COLUMN "revenueAccountId" UUID;
ALTER TABLE "ExpenseCategory" ADD COLUMN "expenseAccountId" UUID;

CREATE UNIQUE INDEX "Account_hotelId_code_key" ON "Account"("hotelId", "code");
CREATE INDEX "Account_hotelId_type_isActive_idx" ON "Account"("hotelId", "type", "isActive");
CREATE INDEX "Account_parentAccountId_idx" ON "Account"("parentAccountId");
CREATE UNIQUE INDEX "AccountingJournal_hotelId_code_key" ON "AccountingJournal"("hotelId", "code");
CREATE INDEX "AccountingJournal_hotelId_type_isActive_idx" ON "AccountingJournal"("hotelId", "type", "isActive");
CREATE UNIQUE INDEX "JournalEntry_hotelId_entryNumber_key" ON "JournalEntry"("hotelId", "entryNumber");
CREATE UNIQUE INDEX "JournalEntry_hotelId_sourceType_sourceId_key" ON "JournalEntry"("hotelId", "sourceType", "sourceId");
CREATE UNIQUE INDEX "JournalEntry_reversedEntryId_key" ON "JournalEntry"("reversedEntryId");
CREATE UNIQUE INDEX "JournalEntry_reversalEntryId_key" ON "JournalEntry"("reversalEntryId");
CREATE INDEX "JournalEntry_hotelId_businessDate_status_idx" ON "JournalEntry"("hotelId", "businessDate", "status");
CREATE INDEX "JournalEntry_hotelId_journalId_postingDate_idx" ON "JournalEntry"("hotelId", "journalId", "postingDate");
CREATE INDEX "JournalEntry_sourceType_sourceId_idx" ON "JournalEntry"("sourceType", "sourceId");
CREATE INDEX "JournalLine_journalEntryId_idx" ON "JournalLine"("journalEntryId");
CREATE INDEX "JournalLine_accountId_journalEntryId_idx" ON "JournalLine"("accountId", "journalEntryId");
CREATE INDEX "JournalLine_sourceType_sourceId_idx" ON "JournalLine"("sourceType", "sourceId");
CREATE UNIQUE INDEX "AccountingSettings_hotelId_key" ON "AccountingSettings"("hotelId");
CREATE INDEX "PaymentMethod_ledgerAccountId_idx" ON "PaymentMethod"("ledgerAccountId");
CREATE INDEX "Service_revenueAccountId_idx" ON "Service"("revenueAccountId");
CREATE INDEX "ExpenseCategory_expenseAccountId_idx" ON "ExpenseCategory"("expenseAccountId");

ALTER TABLE "Account" ADD CONSTRAINT "Account_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Account" ADD CONSTRAINT "Account_parentAccountId_fkey" FOREIGN KEY ("parentAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountingJournal" ADD CONSTRAINT "AccountingJournal_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "AccountingJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_reversedEntryId_fkey" FOREIGN KEY ("reversedEntryId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountingSettings" ADD CONSTRAINT "AccountingSettings_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountingSettings" ADD CONSTRAINT "AccountingSettings_room_fkey" FOREIGN KEY ("defaultRoomRevenueAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountingSettings" ADD CONSTRAINT "AccountingSettings_receivable_fkey" FOREIGN KEY ("defaultGuestReceivableAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountingSettings" ADD CONSTRAINT "AccountingSettings_cash_fkey" FOREIGN KEY ("defaultCashAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountingSettings" ADD CONSTRAINT "AccountingSettings_bank_fkey" FOREIGN KEY ("defaultBankAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountingSettings" ADD CONSTRAINT "AccountingSettings_mobile_fkey" FOREIGN KEY ("defaultMobileMoneyAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountingSettings" ADD CONSTRAINT "AccountingSettings_deposit_fkey" FOREIGN KEY ("defaultDepositAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountingSettings" ADD CONSTRAINT "AccountingSettings_tax_fkey" FOREIGN KEY ("defaultTaxPayableAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountingSettings" ADD CONSTRAINT "AccountingSettings_service_fkey" FOREIGN KEY ("defaultServiceRevenueAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountingSettings" ADD CONSTRAINT "AccountingSettings_discount_fkey" FOREIGN KEY ("defaultDiscountAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountingSettings" ADD CONSTRAINT "AccountingSettings_expense_fkey" FOREIGN KEY ("defaultExpenseAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountingSequence" ADD CONSTRAINT "AccountingSequence_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_ledgerAccountId_fkey" FOREIGN KEY ("ledgerAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Service" ADD CONSTRAINT "Service_revenueAccountId_fkey" FOREIGN KEY ("revenueAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION enforce_account_hierarchy() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_hotel uuid; DECLARE parent_type "AccountType"; DECLARE cycle_found boolean;
BEGIN
  IF NEW."parentAccountId" IS NULL THEN RETURN NEW; END IF;
  SELECT "hotelId", "type" INTO parent_hotel, parent_type FROM "Account" WHERE "id"=NEW."parentAccountId" FOR KEY SHARE;
  IF parent_hotel IS NULL OR parent_hotel <> NEW."hotelId" OR parent_type <> NEW."type" THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='account parent must be the same type and hotel';
  END IF;
  WITH RECURSIVE ancestors AS (
    SELECT "id", "parentAccountId" FROM "Account" WHERE "id"=NEW."parentAccountId"
    UNION ALL SELECT a."id", a."parentAccountId" FROM "Account" a JOIN ancestors x ON a."id"=x."parentAccountId"
  ) SELECT EXISTS(SELECT 1 FROM ancestors WHERE "id"=NEW."id") INTO cycle_found;
  IF cycle_found THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='account hierarchy cannot contain a cycle'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "Account_hierarchy" BEFORE INSERT OR UPDATE OF "parentAccountId", "hotelId", "type" ON "Account" FOR EACH ROW EXECUTE FUNCTION enforce_account_hierarchy();

CREATE OR REPLACE FUNCTION enforce_journal_entry_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE linked_hotel uuid;
BEGIN
  SELECT "hotelId" INTO linked_hotel FROM "AccountingJournal" WHERE "id"=NEW."journalId";
  IF linked_hotel IS NULL OR linked_hotel <> NEW."hotelId" THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='journal entry journal belongs to another hotel'; END IF;
  SELECT "hotelId" INTO linked_hotel FROM "User" WHERE "id"=NEW."createdById";
  IF linked_hotel IS NULL OR linked_hotel <> NEW."hotelId" THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='journal entry creator belongs to another hotel'; END IF;
  IF NEW."postedById" IS NOT NULL THEN SELECT "hotelId" INTO linked_hotel FROM "User" WHERE "id"=NEW."postedById"; IF linked_hotel <> NEW."hotelId" THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='journal entry poster belongs to another hotel'; END IF; END IF;
  IF NEW."reversedById" IS NOT NULL THEN SELECT "hotelId" INTO linked_hotel FROM "User" WHERE "id"=NEW."reversedById"; IF linked_hotel <> NEW."hotelId" THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='journal entry reverser belongs to another hotel'; END IF; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "JournalEntry_tenant" BEFORE INSERT OR UPDATE ON "JournalEntry" FOR EACH ROW EXECUTE FUNCTION enforce_journal_entry_tenant();

CREATE OR REPLACE FUNCTION enforce_journal_line_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE entry_hotel uuid; DECLARE entry_status "JournalEntryStatus"; DECLARE account_hotel uuid; DECLARE account_active boolean;
BEGIN
  SELECT "hotelId", "status" INTO entry_hotel, entry_status FROM "JournalEntry" WHERE "id"=NEW."journalEntryId" FOR KEY SHARE;
  SELECT "hotelId", "isActive" INTO account_hotel, account_active FROM "Account" WHERE "id"=NEW."accountId" FOR KEY SHARE;
  IF entry_hotel IS NULL OR account_hotel IS NULL OR entry_hotel <> account_hotel THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='journal line account belongs to another hotel'; END IF;
  IF NOT account_active THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='journal line account is inactive'; END IF;
  IF entry_status <> 'DRAFT' THEN RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='posted journal lines are immutable'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "JournalLine_integrity" BEFORE INSERT OR UPDATE ON "JournalLine" FOR EACH ROW EXECUTE FUNCTION enforce_journal_line_integrity();

CREATE OR REPLACE FUNCTION protect_journal_line_delete() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE entry_status "JournalEntryStatus";
BEGIN SELECT "status" INTO entry_status FROM "JournalEntry" WHERE "id"=OLD."journalEntryId";
  IF entry_status <> 'DRAFT' THEN RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='posted journal lines cannot be deleted'; END IF;
  RETURN OLD;
END; $$;
CREATE TRIGGER "JournalLine_protect_delete" BEFORE DELETE ON "JournalLine" FOR EACH ROW EXECUTE FUNCTION protect_journal_line_delete();

CREATE OR REPLACE FUNCTION protect_posted_journal_entry() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' AND OLD."status" <> 'DRAFT' THEN RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='posted journal entries cannot be deleted'; END IF;
  IF TG_OP='UPDATE' AND OLD."status" <> 'DRAFT' THEN
    IF NOT (OLD."status"='POSTED' AND NEW."status"='REVERSED'
      AND NEW."hotelId"=OLD."hotelId" AND NEW."journalId"=OLD."journalId" AND NEW."entryNumber"=OLD."entryNumber"
      AND NEW."businessDate"=OLD."businessDate" AND NEW."postingDate"=OLD."postingDate"
      AND NEW."sourceType"=OLD."sourceType" AND NEW."sourceId" IS NOT DISTINCT FROM OLD."sourceId"
      AND NEW."reference" IS NOT DISTINCT FROM OLD."reference" AND NEW."description"=OLD."description"
      AND NEW."createdById"=OLD."createdById" AND NEW."postedById"=OLD."postedById" AND NEW."postedAt"=OLD."postedAt") THEN
      RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='posted journal entries are immutable';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END; $$;
CREATE TRIGGER "JournalEntry_immutable" BEFORE UPDATE OR DELETE ON "JournalEntry" FOR EACH ROW EXECUTE FUNCTION protect_posted_journal_entry();

CREATE OR REPLACE FUNCTION validate_posted_entry(entry_id uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE entry_status "JournalEntryStatus"; DECLARE line_count integer; DECLARE total_debit numeric(19,4); DECLARE total_credit numeric(19,4);
BEGIN
  SELECT "status" INTO entry_status FROM "JournalEntry" WHERE "id"=entry_id;
  IF entry_status <> 'POSTED' THEN RETURN; END IF;
  SELECT count(*), coalesce(sum("debit"),0), coalesce(sum("credit"),0) INTO line_count,total_debit,total_credit FROM "JournalLine" WHERE "journalEntryId"=entry_id;
  IF line_count < 2 OR total_debit <= 0 OR total_debit <> total_credit THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='posted journal entry must contain at least two balanced lines'; END IF;
END; $$;
CREATE OR REPLACE FUNCTION validate_posted_entry_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM validate_posted_entry(CASE WHEN TG_OP='DELETE' THEN OLD."journalEntryId" ELSE NEW."journalEntryId" END); RETURN COALESCE(NEW,OLD); END; $$;
CREATE CONSTRAINT TRIGGER "JournalLine_balanced_entry" AFTER INSERT OR UPDATE OR DELETE ON "JournalLine" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_posted_entry_trigger();
CREATE OR REPLACE FUNCTION validate_entry_status_trigger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM validate_posted_entry(NEW."id"); RETURN NEW; END; $$;
CREATE CONSTRAINT TRIGGER "JournalEntry_balanced" AFTER INSERT OR UPDATE OF "status" ON "JournalEntry" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_entry_status_trigger();

CREATE OR REPLACE FUNCTION enforce_accounting_settings_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE account_ids uuid[]; DECLARE matching integer;
BEGIN
  account_ids := ARRAY[NEW."defaultRoomRevenueAccountId",NEW."defaultGuestReceivableAccountId",NEW."defaultCashAccountId",NEW."defaultBankAccountId",NEW."defaultMobileMoneyAccountId",NEW."defaultDepositAccountId",NEW."defaultTaxPayableAccountId",NEW."defaultServiceRevenueAccountId",NEW."defaultDiscountAccountId",NEW."defaultExpenseAccountId"];
  SELECT count(*) INTO matching FROM "Account" WHERE "id"=ANY(account_ids) AND "hotelId"=NEW."hotelId" AND "isActive"=true;
  IF matching <> cardinality(ARRAY(SELECT DISTINCT unnest(account_ids))) THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='accounting settings accounts must be active and belong to the hotel'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "AccountingSettings_tenant" BEFORE INSERT OR UPDATE ON "AccountingSettings" FOR EACH ROW EXECUTE FUNCTION enforce_accounting_settings_tenant();

CREATE OR REPLACE FUNCTION enforce_optional_account_mapping() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE account_id uuid; DECLARE linked_hotel uuid;
BEGIN
  account_id := CASE TG_TABLE_NAME WHEN 'PaymentMethod' THEN NEW."ledgerAccountId" WHEN 'Service' THEN NEW."revenueAccountId" ELSE NEW."expenseAccountId" END;
  IF account_id IS NULL THEN RETURN NEW; END IF;
  SELECT "hotelId" INTO linked_hotel FROM "Account" WHERE "id"=account_id AND "isActive"=true;
  IF linked_hotel IS NULL OR linked_hotel <> NEW."hotelId" THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='mapped account must be active and belong to the hotel'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "PaymentMethod_account_tenant" BEFORE INSERT OR UPDATE OF "ledgerAccountId", "hotelId" ON "PaymentMethod" FOR EACH ROW EXECUTE FUNCTION enforce_optional_account_mapping();
CREATE TRIGGER "Service_account_tenant" BEFORE INSERT OR UPDATE OF "revenueAccountId", "hotelId" ON "Service" FOR EACH ROW EXECUTE FUNCTION enforce_optional_account_mapping();
CREATE TRIGGER "ExpenseCategory_account_tenant" BEFORE INSERT OR UPDATE OF "expenseAccountId", "hotelId" ON "ExpenseCategory" FOR EACH ROW EXECUTE FUNCTION enforce_optional_account_mapping();

INSERT INTO "Permission" ("id", "key", "description") VALUES
  (gen_random_uuid(), 'accounting.view', 'View accounting records and dashboard'),
  (gen_random_uuid(), 'accounting.manage', 'Configure accounting settings'),
  (gen_random_uuid(), 'chart_of_accounts.view', 'View the chart of accounts'),
  (gen_random_uuid(), 'chart_of_accounts.manage', 'Manage the chart of accounts'),
  (gen_random_uuid(), 'journal.view', 'View accounting journals and entries'),
  (gen_random_uuid(), 'journal.post', 'Create and post journal entries'),
  (gen_random_uuid(), 'journal.reverse', 'Reverse posted journal entries'),
  (gen_random_uuid(), 'financial_reports.view', 'View financial reports')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id" FROM "Role" r CROSS JOIN "Permission" p
WHERE r."name"='ADMIN' AND r."isSystem"=true
  AND p."key" IN ('accounting.view','accounting.manage','chart_of_accounts.view','chart_of_accounts.manage','journal.view','journal.post','journal.reverse','financial_reports.view')
ON CONFLICT DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id" FROM "Role" r CROSS JOIN "Permission" p
WHERE r."name"='MANAGER' AND r."isSystem"=true
  AND p."key" IN ('accounting.view','chart_of_accounts.view','journal.view','financial_reports.view')
ON CONFLICT DO NOTHING;
