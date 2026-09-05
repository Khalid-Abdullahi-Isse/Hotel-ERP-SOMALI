-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'PAID', 'REJECTED');

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "approvedAt" TIMESTAMPTZ(3),
ADD COLUMN     "approvedById" UUID,
ADD COLUMN     "dueDate" DATE,
ADD COLUMN     "invoiceNumber" VARCHAR(120),
ADD COLUMN     "paidAt" TIMESTAMPTZ(3),
ADD COLUMN     "paidById" UUID,
ADD COLUMN     "rejectedAt" TIMESTAMPTZ(3),
ADD COLUMN     "rejectedById" UUID,
ADD COLUMN     "rejectionReason" VARCHAR(500),
ADD COLUMN     "status" "ExpenseStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "submittedAt" TIMESTAMPTZ(3);

-- CreateIndex
CREATE INDEX "Expense_hotelId_status_expenseDate_idx" ON "Expense"("hotelId", "status", "expenseDate");

-- CreateIndex
CREATE INDEX "Expense_createdById_idx" ON "Expense"("createdById");

-- CreateIndex
CREATE INDEX "Expense_approvedById_idx" ON "Expense"("approvedById");

-- CreateIndex
CREATE INDEX "Expense_paidById_idx" ON "Expense"("paidById");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: existing expenses were already posted to accounting at creation, so they are treated as paid.
UPDATE "Expense"
SET "status" = 'PAID', "paidAt" = "createdAt", "paidById" = "createdById"
WHERE "status" = 'DRAFT' AND "reversedAt" IS NULL;

-- Reversed expenses stay in their terminal reversal state (PAID status is retained for audit continuity).
UPDATE "Expense"
SET "status" = 'PAID'
WHERE "status" = 'DRAFT' AND "reversedAt" IS NOT NULL;
