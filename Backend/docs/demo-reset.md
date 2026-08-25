# Guarded demo reset

The demo reset creates a small, repeatable operational dataset without touching a production-shaped database.

## Safety conditions

The command refuses to run unless all of these conditions are true:

- `DEMO_MODE` is exactly `true`.
- `DATABASE_URL` names a database ending in `_demo`.
- `DEMO_HOTEL_CODE` exactly matches `DEMO_RESET_ALLOWED_HOTEL_CODE`.
- The hotel already exists and has the bootstrapped `MANAGER` system role.
- The command includes `--confirm=RESET_DEMO_DATA` (the package script includes it).

## Setup and reset

1. Create an isolated database such as `hotel_erp_demo` and deploy migrations to it.
2. Point `DATABASE_URL` at that database.
3. Run `npm run bootstrap:admin` once with the documented bootstrap environment variables.
4. Set all `DEMO_*` variables shown in `.env.example`.
5. Run `npm run demo:reset`.

The reset preserves bootstrapped users and roles, revokes their sessions, clears hotel-scoped operational and accounting records in one transaction, resets the demo manager password from the environment, and creates 12 available rooms including Deluxe King room 204. It never prints a password.
