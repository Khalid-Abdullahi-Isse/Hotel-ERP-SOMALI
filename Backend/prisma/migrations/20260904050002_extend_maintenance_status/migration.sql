-- Commit lifecycle enum values before the following workflow migration uses them.
-- Keep this separate from 20260904050003_add_maintenance_workflow: PostgreSQL
-- rejects using a newly added enum value in the same transaction.
-- IF NOT EXISTS also supports databases where the workflow already completed.
ALTER TYPE "MaintenanceStatus" ADD VALUE IF NOT EXISTS 'ASSIGNED';
ALTER TYPE "MaintenanceStatus" ADD VALUE IF NOT EXISTS 'ON_HOLD';
ALTER TYPE "MaintenanceStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';
ALTER TYPE "MaintenanceStatus" ADD VALUE IF NOT EXISTS 'VERIFIED';
ALTER TYPE "MaintenanceStatus" ADD VALUE IF NOT EXISTS 'CLOSED';
ALTER TYPE "MaintenanceStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
