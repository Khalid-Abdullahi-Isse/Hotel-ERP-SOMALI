-- Enforce fiscal-period integrity on JournalEntry:
--   1. A journal entry's fiscal period must belong to the same hotel.
--   2. Posting (status -> POSTED/REVERSED) is not allowed into a CLOSED fiscal period.

CREATE OR REPLACE FUNCTION enforce_journal_entry_fiscal_period() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE period_hotel uuid; DECLARE period_status "FiscalPeriodStatus"; DECLARE period_start date; DECLARE period_end date;
BEGIN
  IF NEW."fiscalPeriodId" IS NOT NULL THEN
    SELECT "hotelId", "status", "startDate", "endDate"
      INTO period_hotel, period_status, period_start, period_end
      FROM "FiscalPeriod" WHERE "id"=NEW."fiscalPeriodId" FOR KEY SHARE;
    IF period_hotel IS NULL OR period_hotel <> NEW."hotelId" THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='journal entry fiscal period belongs to another hotel';
    END IF;
    IF (NEW."businessDate"::date < period_start OR NEW."businessDate"::date > period_end) THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='journal entry business date is outside its fiscal period';
    END IF;
  END IF;

  IF (
    (TG_OP = 'INSERT' AND NEW."status" IN ('POSTED','REVERSED'))
    OR (TG_OP = 'UPDATE' AND NEW."status" IN ('POSTED','REVERSED') AND OLD."status" <> NEW."status")
  ) AND NEW."fiscalPeriodId" IS NOT NULL THEN
    IF period_status IS NULL OR period_status <> 'OPEN' THEN
      RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='posting into a closed fiscal period is not allowed';
    END IF;
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER "JournalEntry_fiscal_period"
BEFORE INSERT OR UPDATE OF "fiscalPeriodId", "businessDate", "status" ON "JournalEntry"
FOR EACH ROW EXECUTE FUNCTION enforce_journal_entry_fiscal_period();
