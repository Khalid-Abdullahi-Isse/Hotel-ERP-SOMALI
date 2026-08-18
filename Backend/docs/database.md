# Database design

## Reservation concurrency

`ReservationRoom` supports multiple rooms under one reservation. A PostgreSQL
GiST exclusion constraint rejects overlapping `[checkIn, checkOut)` date ranges
for the same room while status is `PENDING`, `CONFIRMED`, or `CHECKED_IN`.

The half-open range allows one guest to check out on the same day another checks
in. A trigger derives reservation-room dates and status from the parent, prevents
cross-hotel room links, and synchronizes changes. This removes the classic race in
"check availability, then insert": concurrent inserts are arbitrated inside the
database and exactly one conflicting write commits.

Application code must still provide a friendly availability check. It must catch
PostgreSQL exclusion violation `23P01` and return HTTP 409 with
`ROOM_ALREADY_BOOKED`.

Phase 4 adds a stronger application transaction around this final database rule:

1. Begin at `SERIALIZABLE` isolation.
2. Lock selected Room rows in deterministic UUID order.
3. Recheck availability and capacity inside the transaction.
4. Insert Reservation, every ReservationRoom price snapshot, history, and audit.
5. Commit only if every write and the exclusion constraint succeed.

Serialization/deadlock conflicts retry the entire transaction up to three times.
A real overlap is never retried. Any error rolls back every row, including audit
records. PostgreSQL triggers also reject assigning inactive/maintenance rooms and
prevent deactivation or maintenance while active bookings exist.

## Duplicate guests

- `(hotelId, lower(trim(passportNumber)))`: partial unique index
- `(hotelId, lower(trim(nationalId)))`: partial unique index
- normalized phone and email: non-unique lookup indexes

Government identifiers are strong identity signals. Phone and email are useful
matching signals but are not hard-unique because relatives may share them. Phase 4
should return likely matches and require an intentional "create anyway" action
when only a weak signal matches.

## Constraints

The migration adds NOT NULL, foreign key, unique, CHECK, exclusion, and trigger
rules for dates, capacities, positive payments/expenses, nonnegative prices,
invoice arithmetic, hotel boundaries, refund linkage, and append-only audit logs.
Financial rows use restrictive foreign keys rather than cascade deletion.

## Phase 3 room inventory

`RoomType.basePrice` is the only current room price source. `Room` deliberately
has no override column, so operational staff cannot type a different price for
each room. A future reservation will copy this price into
`ReservationRoom.nightlyRate`; later room-type price edits therefore will not
rewrite historical bookings.

Hotel codes, room-type codes, and room numbers are stored in trimmed uppercase
canonical form before their unique constraints are applied. Room-type names also
have a case-insensitive, trimmed per-hotel unique index.

The Room tenant trigger verifies both `roomTypeId` and optional `floorId` belong
to the Room hotel. It also rejects new or changed rooms that use an inactive room
type. The floor foreign key uses `RESTRICT`, preventing a concurrent deletion
from silently clearing the floor on an existing room.

## Index rationale and cost

| Index                                       | Query helped                   | Cost                                  |
| ------------------------------------------- | ------------------------------ | ------------------------------------- |
| Room `(hotelId,status,isActive)`            | availability/dashboard counts  | status updates touch index            |
| Room `(hotelId,roomTypeId,status)`          | availability filtered by type  | extra room write/storage              |
| Reservation `(hotelId,status,checkInDate)`  | arrivals and reservation lists | status/date updates                   |
| Reservation `(hotelId,status,checkOutDate)` | departures                     | status/date updates                   |
| Reservation `(guestId,createdAt)`           | guest stay history             | reservation insert storage            |
| ReservationRoom GiST exclusion              | overlap arbitration            | heavier than B-tree on booking writes |
| Guest normalized phone/email                | duplicate candidate lookup     | guest write/storage                   |
| Payment `(hotelId,paidAt)`                  | daily/monthly revenue          | payment insert storage                |
| Expense `(hotelId,expenseDate)`             | daily/monthly expenses         | expense insert storage                |
| Invoice `(hotelId,status,issuedAt)`         | unpaid/outstanding reports     | status update cost                    |
| Audit `(hotelId,createdAt)`                 | chronological audit review     | append storage                        |
| Audit `(entityType,entityId,createdAt)`     | entity history                 | append storage                        |

Indexes are intentionally absent on low-selectivity flags unless combined with a
hotel and a real filter. Revisit with `EXPLAIN (ANALYZE, BUFFERS)` after production
query patterns exist.

## Migration policy

1. Generate a draft migration and review its SQL.
2. Add any required PostgreSQL-native constraints to that migration.
3. Test on a disposable database and run integrity tests.
4. Back up production before deployment.
5. Run `npm run db:deploy` once per release.
6. Prefer additive, backward-compatible changes; split destructive changes into
   expand/migrate/contract releases.

## Authentication integrity

`AuthSession` represents one seven-day login session. Every refresh token belongs
to one session, is stored only as a SHA-256 hash, and records use, revocation, and
replacement. A trigger prevents a refresh token from outliving its session.

`UserRole` has a PostgreSQL trigger rejecting roles from another hotel. Deferred
constraint triggers prevent a committed transaction from removing or deactivating
the final active ADMIN. System roles cannot be renamed, deactivated, or deleted.
Application transactions add friendlier errors and audit records, while PostgreSQL
remains the final enforcement layer.
