# Accounting Architecture

## Implemented scope

The current release includes a hotel-scoped chart of accounts, journals, immutable double-entry entries, configurable mappings, a central posting service, and ledger-derived General Ledger, Trial Balance, Profit and Loss, and Balance Sheet APIs.

After accounting settings are initialized for a hotel, room and service charges, guest payments and deposits, refunds, expense records, charge voids, and expense reversals post automatically inside the same transaction as the operational event. Existing records still require an approved opening-balance and cutover policy; initialization never silently backfills history.

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

The next accounting boundary is discount/adjustment posting followed by business-date room-night posting and Night Audit. Night Audit must not be exposed until daily posting completeness, reconciliation, date locking, and idempotent reruns are implemented.
