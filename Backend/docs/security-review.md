# V1 security review

## Result

The application-level V1 review passes. No critical or high dependency advisory is
open, tenant and financial database controls are tested, and the production profile
runs with least-privilege operating-system and PostgreSQL identities.

## Verified controls

- Argon2id password hashing; no plaintext passwords
- 15-minute issuer/audience-checked JWT access tokens
- Rotating, hashed, seven-day refresh tokens with reuse detection
- Immediate database-backed logout, deactivation, and password-reset revocation
- ADMIN-only user/role administration and last-admin database protection
- Permission guards and hotel ID derived from the authenticated session
- DTO allow-listing and unknown-property rejection
- Parameterized Prisma/raw SQL calls
- PostgreSQL tenant triggers, booking exclusion constraints, transaction rollback,
  financial immutability, and audit retention
- Login throttling, account lockout, global rate limiting, Helmet, and CORS allow-list
- Early request correlation, safe errors, body limit, and processing timeout
- Sensitive structured-log redaction
- Authenticated metrics with constant-time token comparison
- Non-root/read-only container with resource limits and health check
- Restricted application role cannot create schema objects
- Read-only backup role cannot insert data
- Zero vulnerabilities from `npm audit --audit-level=high`

## Deployment-owner actions

These controls require the real production environment and cannot be completed by a
local source-code change:

- terminate TLS with automatic renewal and test the public HTTPS configuration;
- configure firewall/private PostgreSQL networking;
- store secrets in the chosen provider and enable administrator MFA for that provider;
- connect health, metrics, and logs to a real alert receiver;
- schedule encrypted off-host backups and approve RPO/RTO;
- arrange an independent penetration test before handling high-risk deployments;
- define guest/audit retention and lawful data-access procedures.

Do not claim production launch approval until those owner actions are recorded and a
final test is run on the actual host.
