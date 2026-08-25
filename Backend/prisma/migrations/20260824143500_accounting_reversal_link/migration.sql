ALTER TABLE "JournalEntry"
  ADD CONSTRAINT "JournalEntry_reversalEntryId_fkey"
  FOREIGN KEY ("reversalEntryId") REFERENCES "JournalEntry"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
