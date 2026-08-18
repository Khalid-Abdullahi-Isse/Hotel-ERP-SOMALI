# Phase 4 completion report: guests and reservations

## Simple summary

Phase 4 adds guest records, date-based room availability, and secure reservations.
The combined STAFF user can register guests, search rooms, make bookings, confirm,
cancel, and mark no-shows. STAFF never enters a nightly price. ADMIN or MANAGER may
apply an audited discount.

## Delivered modules

- `guests`: create, search, view, update, and detect duplicates
- `availability`: reusable room search by dates, capacity, type, and floor
- `reservations`: atomic one-room and multi-room bookings
- `reservation history`: append status changes with the acting user
- `audit logs`: guest, booking, room-assignment, price, discount, and status events

All changes are inside the separate `Backend` directory.

## Guest duplicate protection

| Signal                | Behavior                                               |
| --------------------- | ------------------------------------------------------ |
| Passport number       | Hard conflict inside one hotel                         |
| National ID           | Hard conflict inside one hotel                         |
| Phone or email        | Possible-duplicate warning                             |
| Shared family contact | STAFF may continue explicitly; the override is audited |

Phone and email are not hard-unique because relatives may legitimately share
them. Passport and national-ID indexes remain enforced by PostgreSQL after
trimming and case normalization.

## Availability

`GET /api/v1/availability/rooms` accepts:

- `checkInDate` and `checkOutDate` in `YYYY-MM-DD`
- adults and children
- optional room type
- optional floor

It excludes inactive rooms, maintenance rooms, inactive room types, insufficient
capacity, and overlapping active bookings. Each result includes the room type's
nightly price, number of nights, and estimated room total.

The public search is convenient guidance. Reservation creation repeats all checks
inside its protected database transaction because search results can become stale.

## Strong transaction and rollback guarantee

Every reservation uses this sequence:

```text
BEGIN ISOLATION LEVEL SERIALIZABLE
  lock selected Room rows in sorted order
  validate hotel, guest, room, capacity, dates, and availability
  create Reservation
  create every ReservationRoom and nightly-rate snapshot
  create ReservationHistory
  create AuditLog
  PostgreSQL validates the no-overlap exclusion constraint
COMMIT
```

Any failure executes a full rollback. The API cannot leave:

- an empty reservation header
- only some rooms from a multi-room request
- price rows without a reservation
- history for a booking that failed
- an audit event for an action that did not commit

One automated test deliberately makes PostgreSQL fail while inserting the second
room assignment. It verifies Reservation, ReservationRoom, ReservationHistory,
and reservation AuditLog counts all remain zero.

Two simultaneous overlapping requests are also tested. Exactly one complete
reservation commits and the other receives:

```json
{
  "statusCode": 409,
  "code": "ROOM_ALREADY_BOOKED",
  "message": "One or more selected rooms are no longer available."
}
```

Temporary serialization or deadlock conflicts retry the whole transaction up to
three times. Real booking overlaps are never retried.

## Automatic price snapshots

Reservation input contains room IDs, not nightly prices.

```text
Room 101 -> Standard -> USD 100
Room 201 -> Luxury   -> USD 200
```

The current room-type price is copied to `ReservationRoom.nightlyRate` during the
transaction. If Standard later changes to USD 120, the existing reservation keeps
USD 100 while new reservations receive USD 120.

Responses calculate nights, per-room totals, subtotal, discount, and estimated
total using decimal arithmetic. Money is returned as strings to avoid JavaScript
floating-point errors.

## Discounts

A new `reservation.discount` permission is assigned to system ADMIN and MANAGER
roles only. STAFF cannot change the nightly rate or discount.

Discounts:

- cannot be negative
- cannot exceed the room subtotal
- are audited with old and new values
- prevent a room/date change that would make the discount exceed the new subtotal

## Reservation workflow

Supported transitions:

```text
PENDING -> CONFIRMED
PENDING -> CANCELLED
PENDING -> NO_SHOW
CONFIRMED -> CANCELLED
CONFIRMED -> NO_SHOW
```

Cancellation requires a note and immediately releases the rooms. No-show is
rejected before the arrival date in the hotel's timezone. `CHECKED_IN` and
`CHECKED_OUT` remain Phase 5 responsibilities.

Reservations are never permanently deleted.

## API endpoints

| Method | Endpoint                     | Purpose                         |
| ------ | ---------------------------- | ------------------------------- |
| POST   | `/guests`                    | Create guest                    |
| GET    | `/guests`                    | Search/paginate guests          |
| GET    | `/guests/:id`                | View guest                      |
| PATCH  | `/guests/:id`                | Update guest                    |
| GET    | `/availability/rooms`        | Search available rooms          |
| POST   | `/reservations`              | Atomic reservation creation     |
| GET    | `/reservations`              | Filter/paginate reservations    |
| GET    | `/reservations/:id`          | View reservation and history    |
| PATCH  | `/reservations/:id`          | Edit dates, guest counts, notes |
| PUT    | `/reservations/:id/rooms`    | Atomically replace room set     |
| PATCH  | `/reservations/:id/discount` | ADMIN/MANAGER discount          |
| POST   | `/reservations/:id/confirm`  | Confirm                         |
| POST   | `/reservations/:id/cancel`   | Cancel with reason              |
| POST   | `/reservations/:id/no-show`  | Mark no-show                    |

All routes use `/api/v1`, JWT/session authentication, hotel scoping, DTO
allowlisting, and permission guards.

## Database protections

- Half-open `[check-in, check-out)` ranges allow back-to-back stays.
- GiST exclusion constraint rejects active overlaps at commit time.
- Booking numbers are backend-generated and hotel-unique.
- Reservation/guest/room/history relationships are hotel-isolated by triggers.
- Reservation-room dates and statuses are derived from the parent reservation.
- Inactive or maintenance rooms cannot receive reservations.
- Rooms with active reservations cannot be deactivated or marked maintenance.
- Cancellation metadata must be complete and consistent.
- Audit logs remain append-only.

## Permissions

| Capability                      | ADMIN | MANAGER | Combined STAFF |
| ------------------------------- | :---: | :-----: | :------------: |
| Manage guests                   |  Yes  |   Yes   |      Yes       |
| Search availability             |  Yes  |   Yes   |      Yes       |
| Create/edit reservation         |  Yes  |   Yes   |      Yes       |
| Confirm/cancel/no-show          |  Yes  |   Yes   |      Yes       |
| Enter nightly rate              |  No   |   No    |       No       |
| Apply reservation discount      |  Yes  |   Yes   |       No       |
| Permanently delete reservations |  No   |   No    |       No       |

## Verification result

- 30 end-to-end tests passed
- 4 unit tests passed
- formatting passed
- ESLint passed
- NestJS production build passed
- Prisma schema validation passed
- all six migrations applied
- dependency audit reported zero vulnerabilities

The tests cover guest duplicates, shared contacts, tenant isolation, capacity,
availability, price snapshots, discount permissions, multi-room rollback,
concurrent double booking, cancellation release, database constraints, Phase 3
room rules, authentication, and RBAC.

## Intentional Phase 5 boundary

Phase 4 does not perform check-in, set rooms occupied, calculate final stay
charges, or check out guests. Phase 5 will build those transaction-safe workflows
on the confirmed reservation and stored nightly-rate snapshots.
