# Phase 5 completion report: hotel stays

## Simple summary

Phase 5 is complete. A confirmed reservation can now be checked in, receive
configured service charges, display a clear folio, and be checked out. Checkout
creates the final room charges and marks the room `DIRTY` for Phase 7 housekeeping.

The receptionist, cashier, and housekeeper remain one combined `STAFF` user, as
requested. Staff performs daily stay work but never types a service or room price.
ADMIN and MANAGER configure prices; only they may void an incorrect charge.

All code remains inside the separate `Backend` directory.

## What was delivered

- `services`: hotel-specific service catalog and central prices
- `stays`: atomic, retry-safe check-in and check-out
- `charges`: configured service charges and immutable room charges
- `folio`: room lines, extra charges, voids, discount, subtotal, and total
- actual `checkedInAt` and `checkedOutAt` timestamps
- reservation history and audit records for every important action
- PostgreSQL migration with workflow, arithmetic, source, and immutability rules

## Daily workflow

```text
CONFIRMED reservation
        ↓ atomic check-in
CHECKED_IN + Room OCCUPIED
        ↓ configured service charges
Current folio
        ↓ atomic check-out
CHECKED_OUT + final room charges + Room DIRTY
```

Check-in is allowed only during the reservation stay window according to the
hotel's configured timezone. A cancelled, pending, no-show, or checked-out
reservation cannot be checked in.

## Pricing rule

Staff sends only a service ID and quantity:

```json
{
  "serviceId": "service-uuid",
  "quantity": "2.00"
}
```

The backend and PostgreSQL load the configured price. If Airport Transfer is USD
25, quantity 2 creates USD 50. If management later changes the catalog price to
USD 30, the old USD 25 charge remains unchanged and only new charges use USD 30.

Room charges work the same way: checkout uses the nightly-rate snapshot saved by
Phase 4. Staff never enters a room price during check-in or checkout.

## Strong transaction and rollback guarantee

Check-in uses one serializable transaction:

```text
lock Reservation
validate CONFIRMED status and hotel-local date
lock every Room in sorted order
validate availability and occupancy
set Reservation CHECKED_IN + checkedInAt
set Rooms OCCUPIED
append ReservationHistory + AuditLog
commit everything
```

Checkout also uses one serializable transaction:

```text
lock Reservation
validate CHECKED_IN status
lock every Room in sorted order
create exactly one room Charge per ReservationRoom
validate folio and discount
set Reservation CHECKED_OUT + checkedOutAt
set Rooms DIRTY
append ReservationHistory + AuditLog
commit everything
```

Serializable conflicts retry the complete operation up to three times. Repeating
a completed check-in or checkout is idempotent: it returns the existing result and
does not create duplicate history or room charges.

An automated failure test deliberately gives the reservation an invalid discount.
Checkout creates a room charge inside its transaction, detects the invalid total,
and fails. PostgreSQL then rolls back the room charge, checkout status, timestamp,
room status, history, and audit event. Nothing partially commits.

## Charge and void safety

- A charge can only be posted while its reservation is `CHECKED_IN`.
- Service and reservation must belong to the same hotel.
- Service unit price must equal the active configured price.
- Quantity must be positive and total must equal quantity multiplied by unit price.
- One unique room charge is allowed per `ReservationRoom`.
- Room charge quantity/rate must match nights and the Phase 4 price snapshot.
- Financial fields cannot be edited and charge rows cannot be deleted.
- ADMIN/MANAGER voids require a reason and preserve the original row.
- A voided charge cannot be changed again.
- A void is rejected if the remaining subtotal would be lower than the discount.

PostgreSQL enforces the financial structure and immutability. NestJS additionally
enforces permissions, friendly errors, tenant scoping, and audit details.

## Permissions

| Capability                    | ADMIN | MANAGER | Combined STAFF |
| ----------------------------- | :---: | :-----: | :------------: |
| View active services          |  Yes  |   Yes   |      Yes       |
| Configure service prices      |  Yes  |   Yes   |       No       |
| Check in / check out          |  Yes  |   Yes   |      Yes       |
| Add configured service charge |  Yes  |   Yes   |      Yes       |
| View charges and folio        |  Yes  |   Yes   |      Yes       |
| Type room/service unit price  |  No   |   No    |       No       |
| Apply discount                |  Yes  |   Yes   |       No       |
| Void incorrect charge         |  Yes  |   Yes   |       No       |
| Delete financial history      |  No   |   No    |       No       |

## API endpoints

All paths use the `/api/v1` prefix.

| Method | Endpoint                      | Purpose                       |
| ------ | ----------------------------- | ----------------------------- |
| POST   | `/services`                   | Create configured service     |
| GET    | `/services`                   | List allowed services         |
| GET    | `/services/:id`               | View service                  |
| PATCH  | `/services/:id`               | Update details or price       |
| DELETE | `/services/:id`               | Safely deactivate             |
| PATCH  | `/services/:id/restore`       | Restore                       |
| POST   | `/reservations/:id/check-in`  | Atomic check-in               |
| POST   | `/reservations/:id/charges`   | Add configured service charge |
| GET    | `/reservations/:id/charges`   | View posted charge history    |
| GET    | `/reservations/:id/folio`     | View current folio            |
| POST   | `/charges/:id/void`           | Manager/admin void            |
| POST   | `/reservations/:id/check-out` | Atomic operational checkout   |

## Intentional boundaries

Phase 5 completes the operational stay but does not pretend payment was collected.
Phase 6 will add configurable payment methods, deposits, partial payments, refunds,
invoices, and outstanding balances. Phase 7 will move dirty rooms through cleaning
and back to available.

This keeps the backend simple and avoids mixing operational checkout with unfinished
financial settlement rules.

## Verification

- 33 end-to-end tests pass, including 3 new Phase 5 workflow tests
- 4 unit tests pass
- NestJS production build passes
- ESLint passes
- Prettier and Prisma formatting checks pass
- all 7 PostgreSQL migrations are applied
- Phase 5 direct database immutability and transaction rollback are tested

The dependency audit currently reports three high-severity transitive findings in
`deepmerge-ts` through Prisma's configuration toolchain. The automated suggested
fix would force a breaking Prisma downgrade, so it was not applied silently. The
running API does not call Prisma's configuration merger with user-controlled object
graphs, but this toolchain dependency should be upgraded when Prisma publishes a
compatible fix.
