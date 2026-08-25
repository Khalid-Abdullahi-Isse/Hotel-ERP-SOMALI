# Financial Reports

Implemented reports are General Ledger, Trial Balance, Profit and Loss, and Balance Sheet. All derive from journal lines whose entry status is `POSTED` or `REVERSED`; drafts are excluded.

The General Ledger is paginated and supports period, account, journal, source, and search filters. Running balance is partitioned by account and includes opening activity before the selected range.

Trial Balance returns opening balance, period debit, period credit, and closing balance by account. It exposes a serious warning when period debits and credits differ.

Profit and Loss uses credit-minus-debit for revenue and debit-minus-credit for expenses. Balance Sheet uses debit-minus-credit for assets, credit-minus-debit for liabilities/equity, and includes current profit or loss in equity.

PDF, CSV/Excel, Cash Flow, receivables/payables aging, and Daily Manager Report are not implemented yet. They must reuse these validated report DTOs rather than duplicate calculations.
