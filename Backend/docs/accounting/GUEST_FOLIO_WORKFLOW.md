# Guest Folio Workflow

The existing folio is a reservation-scoped projection built from room lines, service charges, discounts, payments, and refunds. Checkout posts room charges, requires a zero operational balance, issues housekeeping work, and preserves charge/payment history.

Ledger event integration is enabled per hotel when accounting settings are initialized. Hotels without accounting settings continue to use the operational folio without automatic ledger entries, which preserves a safe migration path for existing data.

The planned cutover is:

1. Reservation creation creates no revenue.
2. Receipts settle recognized guest receivables first; any remainder credits guest deposits.
3. Earned room and service charges debit guest receivables and credit mapped revenue.
4. Available deposits are automatically applied as charges are earned.
5. Refunds are split between remaining deposits and settled receivables.
6. Charge voids create linked journal reversals; originals are never deleted.

Payment methods require an active same-hotel asset ledger account. Accounting initialization automatically maps familiar cash, card/bank, EVC, Zaad, mobile, and wallet method names; unfamiliar methods must be mapped explicitly.

Existing historical operations require opening balances or an approved backfill before enabling these events.
