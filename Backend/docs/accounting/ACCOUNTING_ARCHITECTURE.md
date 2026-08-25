# Accounting Architecture

## Implemented scope

The current release is the accounting foundation. It adds a hotel-scoped chart of accounts, journals, immutable double-entry entries, configurable mappings, a central posting service, and ledger-derived General Ledger, Trial Balance, Profit and Loss, and Balance Sheet APIs.

Operational `Charge`, `Payment`, `Invoice`, and `Expense` records are not yet auto-posted. This is intentional: existing records predate the ledger and require an approved opening-balance and cutover policy before event integration.

## Boundaries

- Controllers authorize and validate requests; they do not calculate accounting.
- `AccountingPostingService` is the only application service that moves entries from `DRAFT` to `POSTED` or creates reversals.
- Reports read posted journal lines. They never infer revenue from payments.
- `RequestUser.hotelId` is the tenant source. Accounting APIs do not accept a hotel ID from the request body.
- Audit records are written inside the same transaction as the sensitive accounting operation.

## Database guarantees

PostgreSQL enforces line shape, nonnegative decimal amounts, at least two lines, balanced posted entries, same-hotel account/journal/user relationships, source idempotency, immutable posted rows, reversal links, and valid account hierarchies.

Entry numbers use a locked hotel/year sequence and have the form `JE-2026-000001`.

## API surface

- `/api/v1/accounting/accounts`
- `/api/v1/accounting/journals`
- `/api/v1/accounting/journal-entries`
- `/api/v1/accounting/general-ledger`
- `/api/v1/accounting/trial-balance`
- `/api/v1/accounting/profit-loss`
- `/api/v1/accounting/balance-sheet`
- `/api/v1/accounting/settings`

## Next boundary

Phase 2 should emit accounting events from charges, deposits, payments, discounts, refunds, expenses, and checkout. Event handlers must call `AccountingPostingService.postEvent` inside the operational transaction and use the unique `(hotelId, sourceType, sourceId)` key.
