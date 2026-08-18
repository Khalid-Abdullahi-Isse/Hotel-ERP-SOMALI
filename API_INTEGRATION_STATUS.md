# API Integration Status

Last updated: 2026-08-17

## Foundation

Status: IN PROGRESS

- [x] Backend base URL configured through environment variables
- [x] Central browser API client
- [x] Central Server Component API client
- [x] Next.js backend-for-frontend proxy
- [x] Central API error normalization
- [x] TanStack Query defaults and query keys
- [x] Shared loading, error, empty, and skeleton components
- [x] HttpOnly access and refresh cookie custody
- [x] Coordinated refresh rotation within one frontend runtime
- [x] Demo-mode runtime and frontend mock datasets removed
- [x] All navigation screens use backend records or backend-supported management forms
- [ ] Complete API contracts for every backend module
- [ ] Live-backend browser integration suite with demo mode disabled

## Authentication

Status: LIVE HTTP FLOW VERIFIED — INTERACTIVE BROWSER CHECK PENDING

- [x] `POST /auth/login`
- [x] `POST /auth/refresh`
- [x] `POST /auth/logout`
- [x] `POST /auth/logout-all`
- [x] `GET /auth/me`
- [x] Access-token expiry handling for protected page requests
- [x] Access-token expiry handling for browser API requests
- [x] Refresh-token rotation and cookie replacement
- [x] Local cookie cleanup after logout or invalid session
- [x] Protected dashboard routes
- [x] Backend error messages preserved
- [x] Authentication helper tests
- [x] Positive same-origin login/refresh/logout smoke using a configured local account
- [x] Session invalid after logout (`GET /auth/me` returns 401)
- [ ] Interactive in-app browser check (browser runtime unavailable in this session)

## Current User and Permissions

Status: COMPLETE

- [x] Current user loaded from `GET /auth/me`
- [x] Backend roles preserved
- [x] Backend permission keys preserved
- [x] `useCurrentUser()`
- [x] `usePermissions()`
- [x] Complete frontend permission constant map
- [x] Backend remains the authorization authority
- [x] Live room actions use the authenticated user instead of the demo user

## Hotel, Floors, and Room Types

Status: INTEGRATED

- [x] Hotel property settings read/update
- [x] Floors list/create/update/delete-empty-floor
- [x] Room types list/create/update/deactivate/restore
- [x] Permission-aware navigation and actions

## Rooms

Status: LIVE READ FLOW VERIFIED — MUTATION SMOKE PENDING

- [x] List
- [x] Detail
- [x] Create
- [x] Update
- [x] Deactivate
- [x] Pagination
- [x] Search and status filter
- [x] Restore
- [x] Controlled `AVAILABLE` / `MAINTENANCE` status transitions
- [x] Authenticated-user permission checks on list, detail, create, and edit routes
- [x] Active/inactive lifecycle actions
- [x] Backend-aligned room-number search and all six status filters
- [x] Protected route redirects to login without a session
- [x] Same-origin frontend proxy returns the live backend room page
- [x] Server-rendered empty state reflects a real database total of zero
- [ ] Full live-backend module test matrix

## Guests

Status: PARTIALLY INTEGRATED

## Reservations

Status: PARTIALLY INTEGRATED

## Stays, Finance, Operations, Reports, Audit, and Dashboard

Status: PARTIALLY INTEGRATED

- [x] Guest services list/create/update/deactivate/restore
- [x] Payment methods list/create/update/deactivate/restore
- [x] Invoice list with payment and outstanding-balance summaries
- [x] Maintenance requests list/create/start/complete
- [x] Audit log list, filters, and pagination
- [x] Dashboard summary rendered from standard REST requests
- [x] Front desk room board rendered from paginated room and reservation REST requests
- [x] Dashboard and front desk use standard request/response CRUD navigation
- [ ] Full live-backend module test matrix
