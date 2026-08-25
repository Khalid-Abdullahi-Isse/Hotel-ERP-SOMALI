# Chart of Accounts

`POST /api/v1/accounting/settings/initialize` creates an idempotent starter chart and journals for the authenticated hotel. Existing codes are reused only when their type and normal balance are compatible.

The starter chart includes assets, cash, bank, mobile money, guest receivables, liabilities, accounts payable, guest deposits, taxes payable, equity, room/service revenue, sales discounts, cost of sales, and common hotel operating expenses.

Accounts have a hotel-unique code, type, normal balance, optional same-type parent, currency, active flag, and manual-posting flag. Circular parents and cross-hotel parents are rejected in both the service and database. Accounts are deactivated rather than deleted.

Account IDs are never hardcoded in posting logic. `AccountingSettings` holds default mappings. `PaymentMethod.ledgerAccountId`, `Service.revenueAccountId`, and `ExpenseCategory.expenseAccountId` provide future per-source overrides.
