# Sprint 3: Maintenance Workflow Full Redesign

## Schema Changes (migration 20260904050003)

### MaintenanceStatus enum expansion
- Keep: `OPEN`, `IN_PROGRESS`
- Add: `ASSIGNED`, `ON_HOLD`, `COMPLETED`, `VERIFIED`, `CLOSED`, `CANCELLED`
- Keep: `DONE` (legacy, not used in code) — existing 25 DONE rows remapped to `COMPLETED`

### New MaintenancePriority enum
- `LOW`, `MEDIUM`, `HIGH`, `URGENT` (default MEDIUM)

### New columns on MaintenanceRequest
| Column | Type | Purpose |
|--------|------|---------|
| `category` | `VARCHAR(100)?` | Maintenance type (plumbing, electrical, etc.) |
| `priority` | `MaintenancePriority` | Urgency level |
| `assignedAt` | `TIMESTAMPTZ(3)?` | When assigned |
| `heldAt` | `TIMESTAMPTZ(3)?` | When put on hold |
| `resumedAt` | `TIMESTAMPTZ(3)?` | When resumed from hold |
| `completedById` | `UUID?` → FK User | Who completed |
| `verifiedAt` | `TIMESTAMPTZ(3)?` | When verified |
| `verifiedById` | `UUID?` → FK User | Who verified |
| `closedAt` | `TIMESTAMPTZ(3)?` | When closed (room returned to service) |
| `closedById` | `UUID?` → FK User | Who closed |
| `cancelledAt` | `TIMESTAMPTZ(3)?` | When cancelled |
| `cancelledById` | `UUID?` → FK User | Who cancelled |
| `cancelReason` | `VARCHAR(500)?` | Why cancelled |

### Expense ↔ Maintenance link
- `Expense.maintenanceId UUID? @unique` → FK `MaintenanceRequest`
- One maintenance can produce one expense (when completed with a cost)

---

## Workflow Transitions

```
create ──────────► OPEN
                   ├─► ASSIGNED    (assign endpoint)
                   │     ├─► IN_PROGRESS  (start)
                   │     │     ├─► ON_HOLD      (hold) ──► IN_PROGRESS (resume)
                   │     │     ├─► COMPLETED    (complete, record cost)
                   │     │     │     ├─► VERIFIED (verify)
                   │     │     │     │     └─► CLOSED (close, room returns to service)
                   │     │     │     └─► (expense auto-posted if cost)
                   │     │     └─► CANCELLED
                   │     └─► CANCELLED
                   ├─► IN_PROGRESS  (start directly without assign)
                   └─► CANCELLED    (cancel from OPEN)
```

Room lifecycle: room → MAINTENANCE on `start()`; room → previous status on `close()` only.

---

## Backend Changes

### New/updated DTOs
- `CreateMaintenanceDto`: add `category?`, `priority?` (MaintenancePriority enum)
- `UpdateMaintenanceDto`: extend with `category?`, `priority?`
- New `AssignMaintenanceDto`: `{ assignedToId: UUID }`
- New `HoldMaintenanceDto`: `{ reason?: string }`
- New `CloseMaintenanceDto`: `{ notes?: string }`
- New `CancelMaintenanceDto`: `{ reason: string }` (required)
- `CompleteMaintenanceDto`: existing (cost, notes)

### New controller endpoints
| Method | Path | Permission | Purpose |
|--------|------|------------|---------|
| `POST` | `/maintenance/requests/:id/assign` | `maintenance.update` | OPEN→ASSIGNED |
| `POST` | `/maintenance/requests/:id/start` | `maintenance.update` | ASSIGNED/OPEN→IN_PROGRESS |
| `POST` | `/maintenance/requests/:id/hold` | `maintenance.update` | IN_PROGRESS→ON_HOLD |
| `POST` | `/maintenance/requests/:id/resume` | `maintenance.update` | ON_HOLD→IN_PROGRESS |
| `POST` | `/maintenance/requests/:id/complete` | `maintenance.update` | IN_PROGRESS→COMPLETED |
| `POST` | `/maintenance/requests/:id/verify` | `maintenance.update` | COMPLETED→VERIFIED |
| `POST` | `/maintenance/requests/:id/close` | `maintenance.update` | VERIFIED→CLOSED (room returns) |
| `POST` | `/maintenance/requests/:id/cancel` | `maintenance.update` | OPEN/ASSIGNED→CANCELLED |

### Service method changes
- `start()`: accept OPEN or ASSIGNED; set `assignedAt` if not already set
- `complete()`: no longer returns room to service (moved to `close()`); creates expense if cost provided (via `ExpenseAccountingService.postExpense`)
- New `assign()`, `hold()`, `resume()`, `verify()`, `close()`, `cancel()` methods
- `close()`: returns room to `previousRoomStatus` (AVAILABLE or DIRTY); creates housekeeping task if previous was DIRTY

### Expense integration in `complete()`
When cost is provided, create an expense (auto-posted) linked via `maintenanceId`:
- `categoryId`: use a "Maintenance" expense category (must exist or create programmatically)
- `requestKey`: use `crypto.randomUUID()` prefixed with `maint-`
- `status`: APPROVED (autoPost) + posts accounting immediately
- `expense.maintenanceId` set

---

## Frontend Changes

### API contracts (`api-contracts.ts`)
- `ApiMaintenanceStatus` type: expand to include new statuses
- Add `ApiMaintenancePriority` type
- `ApiMaintenanceRequest`: add `category`, `priority`, `completedById`, `verifiedById`, `closedById`, `cancelledById`, `cancelReason`, `assignedAt`, `heldAt`, `resumedAt`

### Maintenance Manager component
- Status badge: show all statuses with appropriate colors
- Action buttons based on current status:
  - OPEN → Assign / Start / Cancel
  - ASSIGNED → Start / Cancel
  - IN_PROGRESS → Hold / Complete
  - ON_HOLD → Resume
  - COMPLETED → Verify
  - VERIFIED → Close
- New form fields: priority dropdown, category text input
- Cancel confirmation dialog (reason required)

### Catalog service (`catalog.service.ts`)
- Add `assign(id, { assignedToId })`, `hold(id)`, `resume(id)`, `verify(id)`, `close(id)`, `cancel(id, { reason })` methods

---

## Migration SQL

The migration `20260904050003_add_maintenance_workflow/migration.sql` has been written and covers:
1. Enum expansion (new MaintenanceStatus values + MaintenancePriority)
2. New columns on MaintenanceRequest
3. Remap 25 DONE→COMPLETED rows
4. Enhanced integrity trigger (validates all new actor columns)
5. Expense ↔ MaintenanceRequest link
6. New indexes for workflow queries

---

## Verification Plan
1. Apply migration via `prisma migrate deploy` (NOT dev — avoids drift reset)
2. Verify enum values in DB
3. Backend: `npx prisma generate && npm run build`
4. Frontend: `npx tsc --noEmit && npx eslint`
5. E2E test: full maintenance workflow transitions (create→assign→start→hold→resume→complete→verify→close + cancel + expense integration)
