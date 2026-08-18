# Phase 8 completion report: dashboard, reports, and audit review

## Simple summary

Managers and administrators now have a hotel-scoped operational dashboard, six
financial/operational reports, and protected audit-log review. Combined `STAFF` does
not receive management reporting or audit access.

## Dashboard

`GET /api/v1/dashboard/summary` returns a current snapshot using the hotel's timezone:

- room counts by status;
- current guests, arrivals, and departures;
- payments, refunds, net revenue, expenses, net result, and outstanding balances;
- payment-method totals;
- housekeeping and maintenance workload.

Money is aggregated with PostgreSQL/Prisma decimals, not JavaScript floating-point
numbers.

## Reports

All report queries are restricted to the authenticated user's hotel. Date reports
use `from` and `to` hotel-business dates, treat `to` as exclusive, and allow at most
365 days.

- `GET /api/v1/reports/revenue`
- `GET /api/v1/reports/expenses`
- `GET /api/v1/reports/occupancy`
- `GET /api/v1/reports/reservations`
- `GET /api/v1/reports/payments`
- `GET /api/v1/reports/outstanding-balances`

## Audit review

- `GET /api/v1/audit-logs` provides paginated filtering by entity, action, and user.
- `GET /api/v1/audit-logs/:id` provides one hotel-scoped audit record.
- Only `MANAGER` and `ADMIN` receive `audit.view`, `dashboard.view`, and `report.view`.

## Performance and integrity

Indexes support payment-status/date and expense-reversal/date report paths. Historical
occupancy includes checked-out stays while filtering every reservation row by hotel.
Reports never trust a hotel identifier supplied by the browser.

## Verification

The end-to-end tests verify dashboard totals after payment/refund/expense activity,
revenue reporting, outstanding balance calculation, and protected audit-log access.
The full project verification result is 35 passing end-to-end tests and 4 passing
unit tests.
