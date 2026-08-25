# Server-side pagination standard

Hotel ERP collection APIs use database-level page pagination. The default page size is **30** and the maximum accepted page size is **100**.

```http
GET /api/v1/reservations?page=2&limit=30&search=Ahmed&status=CONFIRMED
```

PostgreSQL applies tenant filters, search, feature filters, deterministic ordering, `OFFSET`, and `LIMIT` before rows are returned to NestJS. Counts use the same tenant-scoped `where` conditions, so `total` is the number of matching records for the authenticated hotel.

```json
{
  "data": [],
  "pagination": {
    "page": 2,
    "limit": 30,
    "total": 127,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": true
  }
}
```

Invalid numbers (`page=0`, negative values, non-integers, or `limit>100`) return the existing validation error response. Query DTOs extend `PaginationQueryDto`; services use `paginationOffset` and `paginatedResponse`. New list endpoints must use these shared helpers and add an `id` tie-breaker to their business ordering.

## Frontend integration

App Router pages read the asynchronous `searchParams` prop and pass `page`, `limit=30`, search, and filters to server API functions. `ListToolbar` writes search/status into the URL and removes `page` whenever a filter changes. `Pagination` preserves those parameters, shows the current record range, uses accessible disabled buttons, and limits page links with ellipses.

## Redis

High-cardinality paginated/search combinations are deliberately not cached. Redis caching is limited to low-cardinality summaries and lookup/configuration endpoints (dashboard summary, current hotel, floors, room types, services, payment methods, expense categories, and roles). Cache keys include the hotel, user, version, and complete request URL. A successful mutation rotates the hotel's cache version, invalidating prior cached summaries/lookups without scanning keys.

## Audit findings and disposition

| Module / endpoint | Database query before | Frontend consumer | Search / filters | Redis | Initial risk | Final status |
|---|---|---|---|---|---|---|
| Reservations `GET /reservations` | Prisma `findMany`, partially paged at 25 | Reservations, dashboard | Search/status/guest/room/dates | No list cache | Inconsistent size; browser-only filtering | 30-row DB pagination and URL filters |
| Reservation timeline `GET /reservations/timeline` | All active rooms + all weekly overlaps | Timeline page | Week | No | Unbounded rooms | 30 rooms; overlaps restricted to those rooms |
| Rooms `GET /rooms` | Prisma pagination at 25 | Rooms, front desk, maintenance lookup | Search/status/type/floor/active | No list cache | Inconsistent size; front desk downloaded every page | 30-row DB pagination; front desk no longer downloads all pages |
| Availability `GET /availability/rooms` | All matching rooms | Reservation/check-in forms | Dates/type/floor/capacity | No | Large properties could return every available room | 30-row DB page plus matching total |
| Guests `GET /guests` | Prisma pagination at 25 | Guests | Search | No | Browser searched only loaded page | 30-row DB pagination and URL search |
| Payments `GET /payments` | All hotel payments | Payments/accounting | None | No | Unbounded financial history | 30-row DB pagination; server search/status/method/kind |
| Reservation payments `GET /reservations/:id/payments` | All reservation payments | Check-in flow | Reservation scope | No | Long folios could grow | 30-row DB pagination; aggregate summary remains complete |
| Charges `GET /reservations/:id/charges` | All reservation charges | API clients | Reservation scope | No | Long stays could grow | 30-row DB pagination |
| Expenses `GET /expenses` | All hotel expenses | Expenses/accounting | None | No | Unbounded financial history | 30-row DB pagination and server search/category/reversal filters |
| Invoices `GET /invoices` | All invoices plus per-invoice folio/payment queries | Invoices/accounting | None | No | Unbounded list and N+1 queries | 30-row DB pagination; one grouped payment-total query per page |
| Audit logs `GET /audit-logs` | Paged at 50 | Audit log page | Entity/action/user | No | Wrong default; non-unique order | 30-row DB pagination with `createdAt,id` order |
| Housekeeping `GET /housekeeping/tasks` | All tasks | Housekeeping | None | No | Unbounded task history | 30-row DB pagination and server search/status/room/assignee filters |
| Maintenance `GET /maintenance/requests` | All requests | Maintenance | None | No | Unbounded history | 30-row DB pagination and server search/status/room/assignee filters |
| Users `GET /users` | All hotel users | Users/employees/maintenance lookup | None | No | Growing staff list and browser-only discovery | 30-row DB pagination and server search/status filters |
| Outstanding report | Returned every outstanding invoice row, then frontend summed it | Accounting | Hotel scope | No | Downloaded all financial rows for one number | Single PostgreSQL aggregate row |
| Floors, room types, services, payment methods, expense categories, roles/permissions | Small ordered lookup queries | Settings/dropdowns | Active flags where relevant | Selectively cached | Low | Intentionally not paginated |
| Dashboard/report aggregates, health, metrics | `count`, `sum`, `groupBy`, aggregate SQL | Dashboard/reports | Date/hotel | Dashboard only | Low row-transfer risk | Intentionally not paginated |

## Performance notes

Existing Prisma indexes already match the principal tenant-scoped access paths: reservation hotel/status/dates, room hotel/status/activity, guest hotel/name/created date, payment hotel/paid date, expense hotel/expense date, invoice hotel/status/issued date, operations hotel/status/created date, and audit hotel/created date. No speculative migration was added. Search uses case-insensitive `contains`, which can still require scans at very high scale; PostgreSQL trigram indexes should only be added after real query-plan measurements show the need.

Offset pagination is simple and bookmarkable, but very deep pages become slower and concurrent inserts can shift records between requests. Audit logs now have isolated pagination code and stable ordering so they can later move to cursor pagination without changing other modules.
