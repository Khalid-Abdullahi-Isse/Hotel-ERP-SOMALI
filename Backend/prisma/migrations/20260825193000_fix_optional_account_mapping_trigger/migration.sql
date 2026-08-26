CREATE OR REPLACE FUNCTION enforce_optional_account_mapping() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE account_id uuid; DECLARE linked_hotel uuid;
BEGIN
  IF TG_TABLE_NAME = 'PaymentMethod' THEN
    account_id := NEW."ledgerAccountId";
  ELSIF TG_TABLE_NAME = 'Service' THEN
    account_id := NEW."revenueAccountId";
  ELSIF TG_TABLE_NAME = 'ExpenseCategory' THEN
    account_id := NEW."expenseAccountId";
  ELSE
    RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='unsupported optional account mapping table';
  END IF;

  IF account_id IS NULL THEN RETURN NEW; END IF;
  SELECT "hotelId" INTO linked_hotel
  FROM "Account"
  WHERE "id"=account_id AND "isActive"=true;
  IF linked_hotel IS NULL OR linked_hotel <> NEW."hotelId" THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='mapped account must be active and belong to the hotel';
  END IF;
  RETURN NEW;
END; $$;
