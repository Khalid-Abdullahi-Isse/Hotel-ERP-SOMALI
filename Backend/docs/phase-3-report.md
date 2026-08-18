# Phase 3 completion report: rooms and pricing

## Simple summary

Phase 3 provides the hotel's physical room catalog. An ADMIN or MANAGER configures
the hotel, floors, room types, and rooms once. STAFF can then see the room list and
its calculated prices but cannot change the configuration or type prices manually.

Example:

| Room type | Default nightly price | Example rooms |
| --------- | --------------------: | ------------- |
| Standard  |            USD 100.00 | 101, 102      |
| Luxury    |            USD 200.00 | 201, 202      |

Room 101 automatically returns the Standard price. Room 201 automatically returns
the Luxury price. There is no room-level price override and STAFF never enters a
price during room work.

## Implemented modules

- `hotels`: view and edit the authenticated user's current hotel
- `floors`: create, list, view, update, and delete empty floors
- `room-types`: define capacity and one default nightly price; deactivate/restore
- `rooms`: create, list, filter, update, deactivate/restore, and change safe statuses
- `audit-logs`: records all Phase 3 configuration, price, and status changes

All code is inside the separate `Backend` directory. The older root-level backend
and frontend were not changed.

## Permission behavior

| Capability                        | ADMIN | MANAGER | Combined STAFF |
| --------------------------------- | :---: | :-----: | :------------: |
| View/update hotel settings        |  Yes  |   Yes   |       No       |
| Manage floors                     |  Yes  |   Yes   |       No       |
| Manage room types and prices      |  Yes  |   Yes   |       No       |
| Create/update/deactivate rooms    |  Yes  |   Yes   |       No       |
| View rooms and inherited prices   |  Yes  |   Yes   |      Yes       |
| Create/delete users or edit roles |  Yes  |   No    |       No       |

STAFF remains one combined operational user for reception, cashier, and
housekeeping work. Those responsibilities are not split into three accounts.

## REST endpoints

All endpoints use the `/api/v1` prefix and require a bearer access token.

| Method | Endpoint                  | Purpose                          |
| ------ | ------------------------- | -------------------------------- |
| GET    | `/hotels/current`         | Read current hotel               |
| PATCH  | `/hotels/current`         | Update current hotel             |
| POST   | `/floors`                 | Create floor                     |
| GET    | `/floors`                 | List floors                      |
| GET    | `/floors/:id`             | Read floor                       |
| PATCH  | `/floors/:id`             | Update floor                     |
| DELETE | `/floors/:id`             | Delete an empty floor            |
| POST   | `/room-types`             | Create type and default price    |
| GET    | `/room-types`             | List active and inactive types   |
| GET    | `/room-types/:id`         | Read room type                   |
| PATCH  | `/room-types/:id`         | Edit capacity, details, or price |
| DELETE | `/room-types/:id`         | Deactivate unused type           |
| PATCH  | `/room-types/:id/restore` | Restore type                     |
| POST   | `/rooms`                  | Create room                      |
| GET    | `/rooms`                  | Paginated room list and filters  |
| GET    | `/rooms/:id`              | Read room and inherited price    |
| PATCH  | `/rooms/:id`              | Edit room details                |
| PATCH  | `/rooms/:id/status`       | Available/maintenance transition |
| DELETE | `/rooms/:id`              | Deactivate room                  |
| PATCH  | `/rooms/:id/restore`      | Restore room                     |

Room filters include room-number search, floor, room type, status, active state,
page, and page size. Page size is capped at 100.

## Pricing workflow

Create a Standard type once:

```json
{
  "code": "STD",
  "name": "Standard",
  "capacityAdults": 2,
  "capacityChildren": 1,
  "basePrice": "100.00"
}
```

Then create room 101 with only its room type and optional floor:

```json
{
  "roomNumber": "101",
  "roomTypeId": "ROOM_TYPE_UUID",
  "floorId": "FLOOR_UUID"
}
```

The room response includes `effectivePrice: "100"`. Updating the Standard type to
`125.50` automatically makes its rooms return `effectivePrice: "125.5"`. Money is
returned as a decimal string to avoid JavaScript floating-point errors.

When Phase 4 creates a reservation, it must copy the current type price into the
reservation-room nightly rate. Existing bookings will then retain their agreed
price even if the room type changes later.

## Room status rules

Phase 3 permits only:

```text
AVAILABLE <-> MAINTENANCE
```

`RESERVED` and `OCCUPIED` belong to reservation/check-in workflows. `DIRTY` and
`CLEANING` belong to check-out/housekeeping workflows. General room edits cannot
set any status, preventing accidental operational corruption.

## Database and security protections

- Every query derives `hotelId` from the authenticated JWT/session, never request data.
- Cross-hotel resource identifiers are rejected by NestJS and PostgreSQL.
- Room numbers and room-type codes are trimmed and uppercased before uniqueness checks.
- Room-type names are unique per hotel without case or surrounding-space differences.
- Prices are nonnegative PostgreSQL decimals; capacities are database constrained.
- A room must reference an active type belonging to the same hotel.
- An optional floor must belong to the same hotel.
- Populated floors use a restrictive foreign key and cannot be deleted.
- Rooms and room types use audited deactivation rather than destructive deletion.
- A room type with active rooms cannot be deactivated.
- Reserved or occupied rooms cannot be deactivated.
- Price changes record old and new values in the append-only audit log.

## Important trade-offs

- There are no per-room price exceptions. This intentionally favors simple,
  consistent pricing. Seasonal rates and discounts should become controlled rate
  rules later rather than free-text STAFF input.
- Floors are permanently deleted only when empty because an empty structural row
  has no business history. Rooms and types are retained because reservations will
  reference them.
- Room lists use offset pagination. It is simple and appropriate for normal hotel
  room counts; cursor pagination would add unnecessary complexity at this scale.

## Verification

The Phase 3 suite covers inherited Standard/Luxury prices, permissions, price
auditing, forbidden room overrides, tenant isolation at API and database levels,
concurrent duplicate room creation, safe floor/type cleanup, and controlled status
transitions. The complete project is also checked with formatting, linting, Prisma
validation, compilation, unit tests, database integrity tests, and Docker/API smoke
verification before handoff.

## Next phase

Phase 4 will add guests, duplicate detection, reservations, reservation rooms, the
availability service, and PostgreSQL-enforced double-booking protection. It will
consume Phase 3 room-type prices without asking STAFF to enter them.
