# Postman API suite

Import these two files into Postman:

- `Hotel-ERP.postman_collection.json`
- `Hotel-ERP.local.postman_environment.json`

Select **Somali Hotel ERP - Local**, then set:

- `adminIdentifier` to the bootstrapped ADMIN email or username
- `adminPassword` to the bootstrap password
- `monitoringToken` to the backend `MONITORING_TOKEN`
- `baseUrl` only if the API is not at `http://localhost:3005/api/v1`

The local Docker stack uses non-conflicting host ports: API on `3005`, Postgres on `5433`, and Redis on `6380`.

Run folders in numeric order. The Login requests save the JWT access token, and
Postman's cookie jar retains the rotating HttpOnly refresh cookie. Create requests
save IDs into collection variables for later requests. Dates and idempotency UUIDs
are generated at runtime.

The suite is intentionally stateful and creates test data. It deactivates/restores
resources when the API supports that lifecycle, but it does not remove retained
audit, reservation, payment, invoice, expense, or user history.

To regenerate the JSON artifacts after changing the generator:

```powershell
npm run postman:generate
```
