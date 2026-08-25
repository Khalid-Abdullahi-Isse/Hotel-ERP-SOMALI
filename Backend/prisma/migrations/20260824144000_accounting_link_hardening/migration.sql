ALTER TABLE "JournalEntry"
  ADD CONSTRAINT "JournalEntry_source_type_not_blank" CHECK (btrim("sourceType") <> '');

CREATE OR REPLACE FUNCTION enforce_journal_entry_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE linked_hotel uuid;
BEGIN
  SELECT "hotelId" INTO linked_hotel FROM "AccountingJournal" WHERE "id"=NEW."journalId";
  IF linked_hotel IS NULL OR linked_hotel <> NEW."hotelId" THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='journal entry journal belongs to another hotel'; END IF;
  SELECT "hotelId" INTO linked_hotel FROM "User" WHERE "id"=NEW."createdById";
  IF linked_hotel IS NULL OR linked_hotel <> NEW."hotelId" THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='journal entry creator belongs to another hotel'; END IF;
  IF NEW."postedById" IS NOT NULL THEN SELECT "hotelId" INTO linked_hotel FROM "User" WHERE "id"=NEW."postedById"; IF linked_hotel IS NULL OR linked_hotel <> NEW."hotelId" THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='journal entry poster belongs to another hotel'; END IF; END IF;
  IF NEW."reversedById" IS NOT NULL THEN SELECT "hotelId" INTO linked_hotel FROM "User" WHERE "id"=NEW."reversedById"; IF linked_hotel IS NULL OR linked_hotel <> NEW."hotelId" THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='journal entry reverser belongs to another hotel'; END IF; END IF;
  IF NEW."reversedEntryId" IS NOT NULL THEN SELECT "hotelId" INTO linked_hotel FROM "JournalEntry" WHERE "id"=NEW."reversedEntryId"; IF linked_hotel IS NULL OR linked_hotel <> NEW."hotelId" THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='reversed entry belongs to another hotel'; END IF; END IF;
  IF NEW."reversalEntryId" IS NOT NULL THEN SELECT "hotelId" INTO linked_hotel FROM "JournalEntry" WHERE "id"=NEW."reversalEntryId"; IF linked_hotel IS NULL OR linked_hotel <> NEW."hotelId" THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='reversal entry belongs to another hotel'; END IF; END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION enforce_journal_line_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE entry_hotel uuid; DECLARE entry_status "JournalEntryStatus"; DECLARE account_hotel uuid; DECLARE account_active boolean; DECLARE account_currency text;
BEGIN
  SELECT "hotelId", "status" INTO entry_hotel, entry_status FROM "JournalEntry" WHERE "id"=NEW."journalEntryId" FOR KEY SHARE;
  SELECT "hotelId", "isActive", "currency" INTO account_hotel, account_active, account_currency FROM "Account" WHERE "id"=NEW."accountId" FOR KEY SHARE;
  IF entry_hotel IS NULL OR account_hotel IS NULL OR entry_hotel <> account_hotel THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='journal line account belongs to another hotel'; END IF;
  IF NOT account_active THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='journal line account is inactive'; END IF;
  IF account_currency <> NEW."currency" THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='journal line currency must match account currency'; END IF;
  IF entry_status <> 'DRAFT' THEN RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='posted journal lines are immutable'; END IF;
  RETURN NEW;
END; $$;
