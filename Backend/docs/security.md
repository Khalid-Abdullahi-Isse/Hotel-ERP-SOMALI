# Authentication and authorization

## Token model

- Access JWT lifetime: 15 minutes
- Refresh session lifetime: 7 days
- JWT algorithm: HS256 with strict issuer and audience validation
- Refresh token: 256 random bits, stored only as a SHA-256 hash
- Refresh cookie: HttpOnly, SameSite=Lax, restricted to `/api/v1/auth`
- Production requires `AUTH_COOKIE_SECURE=true` and HTTPS

Refreshing rotates the token. Reusing an already-used token revokes the complete
session. Logging out revokes the current session; logout-all revokes every session
for that user. Protected requests check the session and user in PostgreSQL, so
deactivation takes effect immediately.

## Roles

| Role    | Purpose                                                                                     |
| ------- | ------------------------------------------------------------------------------------------- |
| ADMIN   | Full access, including user and role administration                                         |
| MANAGER | Hotel operations, finance, refunds, reports, and audit viewing; no user/role administration |
| STAFF   | Combined reception, cashier, check-in/out, housekeeping, and basic maintenance              |

Only ADMIN can create, update, deactivate, restore, unlock, reset passwords, or
assign roles to users. Only ADMIN can create custom roles, change permissions, or
deactivate unused custom roles. System roles are permanent.

## Endpoints

### Public

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `GET /api/v1/health/live`
- `GET /api/v1/health/ready`

### Authenticated

- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/logout-all`

### ADMIN only

- `POST /api/v1/users`
- `GET /api/v1/users`
- `GET /api/v1/users/:id`
- `PATCH /api/v1/users/:id`
- `DELETE /api/v1/users/:id` (audited deactivation)
- `PATCH /api/v1/users/:id/restore`
- `PATCH /api/v1/users/:id/unlock`
- `POST /api/v1/users/:id/reset-password`
- `PUT /api/v1/users/:id/roles`
- `GET /api/v1/roles`
- `GET /api/v1/roles/permissions`
- `POST /api/v1/roles`
- `PATCH /api/v1/roles/:id`
- `PUT /api/v1/roles/:id/permissions`
- `DELETE /api/v1/roles/:id`

## Operational rules

- Use a random JWT secret of at least 32 characters; 64 random bytes is preferred.
- Never log or persist plaintext passwords, access tokens, or refresh tokens.
- Five failed logins lock the account for 15 minutes.
- Unknown users and incorrect passwords receive the same response.
- Password resets and deactivation revoke all existing sessions.
- The database and application both protect the last active administrator.
- Production startup requires secure cookies, disabled Swagger, a monitoring token,
  and the restricted application database URL.
- Operational metrics require `X-Monitoring-Token`; rotate it as a secret.
- The schema owner runs migrations only. The API uses `hotel_erp_app`, and backups use
  the read-only `hotel_erp_backup` role.
