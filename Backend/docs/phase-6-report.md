# Phase 6 completion report: finance

## Simple summary

The hotel can now receive deposits, partial payments, and final payments without
staff re-entering room prices. It can also refund payments, issue invoices after
checkout, record operating expenses, and manage hotel-specific payment methods and
expense categories.

Financial records are retained. Corrections use refunds, invoice voids, and expense
reversals instead of deleting history.

## Daily workflow

1. `ADMIN` or `MANAGER` configures payment methods and expense categories once.
2. Combined `STAFF` records a deposit, partial payment, final payment, or expense.
3. The API calculates the live folio balance and rejects an overpayment.
4. After checkout, staff issues one invoice from the stored charge snapshots.
5. Authorized managers can refund a payment, void an unpaid invoice, or reverse an
   expense with a reason.

## Transaction and money protection

- PostgreSQL `DECIMAL` values are used for money; JavaScript floating-point math is
  not authoritative.
- Every payment, refund, and expense carries a client-generated UUID request key.
  Retrying the same request returns the same record instead of duplicating money.
- Refund processing locks the original payment. Concurrent refunds cannot together
  exceed the original completed payment.
- Payment creation is capped at the current folio balance.
- Invoice lines are server-generated from immutable charge snapshots. The client
  cannot submit an invoice total.
- Issued invoice financial fields and payment financial fields are immutable at the
  database level.
- Paid invoices cannot be voided. Expenses can be reversed only once.
- Hotel ownership, actor identity, payment-method state, and linked reservation are
  checked again by PostgreSQL triggers.
- A failed transaction is rolled back completely; partial financial data is not
  committed.

## Permissions

- Combined `STAFF`: view payment methods, post/view payments, issue/view invoices,
  post/view expenses, and use the existing permitted refund workflow.
- `MANAGER` and `ADMIN`: all staff capabilities plus configure payment methods and
  expense categories, void invoices, and reverse expenses.
- All mutations produce audit history.

## Main API endpoints

- `GET/POST /api/v1/payment-methods`
- `PATCH/DELETE /api/v1/payment-methods/:id`
- `PATCH /api/v1/payment-methods/:id/restore`
- `POST /api/v1/payments`
- `GET /api/v1/payments/:id`
- `GET /api/v1/reservations/:id/payments`
- `POST /api/v1/payments/:id/refunds`
- `POST /api/v1/reservations/:id/invoice`
- `GET /api/v1/invoices` and `GET /api/v1/invoices/:id`
- `POST /api/v1/invoices/:id/void`
- `GET/POST /api/v1/expense-categories`
- `PATCH/DELETE /api/v1/expense-categories/:id`
- `PATCH /api/v1/expense-categories/:id/restore`
- `GET/POST /api/v1/expenses`
- `GET /api/v1/expenses/:id`
- `POST /api/v1/expenses/:id/reverse`

## Verification

The end-to-end tests cover payment retry idempotency, partial payment, refund,
over-refund rejection, concurrent refunds, invoice totals, expense authorization,
expense reversal, and direct database mutation rejection.
