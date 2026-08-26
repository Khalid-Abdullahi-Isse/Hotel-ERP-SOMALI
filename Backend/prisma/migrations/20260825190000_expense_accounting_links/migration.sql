ALTER TABLE "AccountingSettings"
  ADD COLUMN "defaultAccountsPayableAccountId" UUID;

UPDATE "AccountingSettings" settings
SET "defaultAccountsPayableAccountId" = account."id"
FROM "Account" account
WHERE account."hotelId" = settings."hotelId"
  AND account."code" = '2100'
  AND account."type" = 'LIABILITY'
  AND account."isActive" = true;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "AccountingSettings"
    WHERE "defaultAccountsPayableAccountId" IS NULL
  ) THEN
    RAISE EXCEPTION 'Every initialized hotel must have an active 2100 Accounts Payable account';
  END IF;
END $$;

ALTER TABLE "AccountingSettings"
  ALTER COLUMN "defaultAccountsPayableAccountId" SET NOT NULL,
  ADD CONSTRAINT "AccountingSettings_accounts_payable_fkey"
    FOREIGN KEY ("defaultAccountsPayableAccountId") REFERENCES "Account"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "AccountingSettings_defaultAccountsPayableAccountId_idx"
  ON "AccountingSettings"("defaultAccountsPayableAccountId");

CREATE OR REPLACE FUNCTION enforce_accounting_settings_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE account_ids uuid[]; DECLARE matching integer;
BEGIN
  account_ids := ARRAY[
    NEW."defaultRoomRevenueAccountId",
    NEW."defaultGuestReceivableAccountId",
    NEW."defaultCashAccountId",
    NEW."defaultBankAccountId",
    NEW."defaultMobileMoneyAccountId",
    NEW."defaultDepositAccountId",
    NEW."defaultTaxPayableAccountId",
    NEW."defaultServiceRevenueAccountId",
    NEW."defaultDiscountAccountId",
    NEW."defaultExpenseAccountId",
    NEW."defaultAccountsPayableAccountId"
  ];
  SELECT count(*) INTO matching
  FROM "Account"
  WHERE "id"=ANY(account_ids) AND "hotelId"=NEW."hotelId" AND "isActive"=true;
  IF matching <> cardinality(ARRAY(SELECT DISTINCT unnest(account_ids))) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='accounting settings accounts must be active and belong to the hotel';
  END IF;
  RETURN NEW;
END; $$;
