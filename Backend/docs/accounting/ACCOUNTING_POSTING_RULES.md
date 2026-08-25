# Accounting Posting Rules

Every line contains exactly one positive debit or one positive credit. Amounts use `DECIMAL(19,4)`; exchange rates use `DECIMAL(19,8)`. The application validator uses scaled integers and PostgreSQL performs the final deferred balance check.

A draft must contain at least two valid lines. Posting rejects inactive journals, inactive or cross-hotel accounts, disallowed manual accounts, and any debit/credit difference.

Posted entries and lines are immutable. A correction is made by `POST /accounting/journal-entries/:id/reverse`, which creates a new posted entry with debit and credit swapped and marks the original `REVERSED`. Repeating reversal returns the existing reversal.

Programmatic events use `AccountingPostingService.postEvent`. `(hotelId, sourceType, sourceId)` is unique, so retries return the original entry instead of double-posting.

Reports include both `POSTED` and `REVERSED` originals plus posted reversal entries. This preserves the historical original and lets the reversal cancel it mathematically.
