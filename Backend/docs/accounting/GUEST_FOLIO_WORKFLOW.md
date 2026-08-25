# Guest Folio Workflow

The existing folio is a reservation-scoped projection built from room lines, service charges, discounts, payments, and refunds. Checkout posts room charges, requires a zero operational balance, issues housekeeping work, and preserves charge/payment history.

Ledger event integration is not implemented in this foundation release. Until Phase 2, operational folio totals and the accounting ledger are separate domains.

The planned cutover is:

1. Reservation creation creates no revenue.
2. A pre-stay receipt posts cash/bank/mobile money against guest deposits.
3. Earned room and service charges debit guest receivables and credit mapped revenue.
4. Applied deposits debit guest deposits and credit guest receivables.
5. Settlements debit the mapped payment account and credit guest receivables.
6. Refunds and discounts create linked events; originals are never deleted.

Existing historical operations require opening balances or an approved backfill before enabling these events.
