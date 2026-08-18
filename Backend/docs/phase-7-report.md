# Phase 7 completion report: housekeeping and maintenance

## Simple summary

Checkout now automatically creates one housekeeping task for each checked-out room.
The same combined `STAFF` user can work as receptionist, cashier, or housekeeper;
three separate accounts are not required.

Room and task states change in the same transaction, so a task cannot say cleaning
is complete while the room remains dirty, or release a room that is under active
maintenance.

## Housekeeping workflow

1. Checkout changes the room from `OCCUPIED` to `DIRTY` and creates the task.
2. Staff can assign the task, add notes, and start it.
3. Starting changes task `PENDING` to `IN_PROGRESS` and room `DIRTY` to `CLEANING`.
4. Completion changes the task to `COMPLETED` and the room to `AVAILABLE` only when
   no active maintenance blocks release.

Only one active housekeeping task may exist for a room. PostgreSQL rejects invalid
state transitions, cross-hotel assignments, and inconsistent timestamps.

## Maintenance workflow

1. Staff can report and view a maintenance problem.
2. `MANAGER` or `ADMIN` assigns, edits, starts, and completes work.
3. Starting work first checks for active reservations and housekeeping conflicts,
   then places the room in `MAINTENANCE` and remembers its previous status.
4. Completion restores `AVAILABLE`, or restores `DIRTY` and creates housekeeping
   work when cleaning is still required.

Maintenance cannot start on an occupied or actively booked room. Only one active
maintenance request may exist for a room.

## Main API endpoints

- `GET /api/v1/housekeeping/tasks`
- `GET/PATCH /api/v1/housekeeping/tasks/:id`
- `POST /api/v1/housekeeping/tasks/:id/start`
- `POST /api/v1/housekeeping/tasks/:id/complete`
- `GET/POST /api/v1/maintenance/requests`
- `GET/PATCH /api/v1/maintenance/requests/:id`
- `POST /api/v1/maintenance/requests/:id/start`
- `POST /api/v1/maintenance/requests/:id/complete`

## Verification

The end-to-end tests cover the checkout-to-cleaning handoff, legal task transitions,
automatic room release, staff maintenance reporting, manager-only maintenance work,
maintenance cost capture, and final room status.
