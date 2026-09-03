-- CreateEnum
CREATE TYPE "FiscalPeriodStatus" AS ENUM ('OPEN', 'CLOSED');

-- DropIndex
DROP INDEX "AccountingSettings_defaultAccountsPayableAccountId_idx";

-- DropIndex
DROP INDEX "Expense_hotelId_reversedAt_expenseDate_idx";

-- DropIndex
DROP INDEX "Payment_hotelId_status_paidAt_idx";

-- AlterTable
ALTER TABLE "JournalEntry" ADD COLUMN     "fiscalPeriodId" UUID;

-- CreateTable
CREATE TABLE "FiscalPeriod" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotelId" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "FiscalPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "isOpening" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "FiscalPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FiscalPeriod_hotelId_startDate_endDate_idx" ON "FiscalPeriod"("hotelId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "FiscalPeriod_hotelId_startDate_status_idx" ON "FiscalPeriod"("hotelId", "startDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalPeriod_hotelId_name_key" ON "FiscalPeriod"("hotelId", "name");

-- RenameForeignKey
ALTER TABLE "AccountingSettings" RENAME CONSTRAINT "AccountingSettings_accounts_payable_fkey" TO "AccountingSettings_defaultAccountsPayableAccountId_fkey";

-- RenameForeignKey
ALTER TABLE "AccountingSettings" RENAME CONSTRAINT "AccountingSettings_bank_fkey" TO "AccountingSettings_defaultBankAccountId_fkey";

-- RenameForeignKey
ALTER TABLE "AccountingSettings" RENAME CONSTRAINT "AccountingSettings_cash_fkey" TO "AccountingSettings_defaultCashAccountId_fkey";

-- RenameForeignKey
ALTER TABLE "AccountingSettings" RENAME CONSTRAINT "AccountingSettings_deposit_fkey" TO "AccountingSettings_defaultDepositAccountId_fkey";

-- RenameForeignKey
ALTER TABLE "AccountingSettings" RENAME CONSTRAINT "AccountingSettings_discount_fkey" TO "AccountingSettings_defaultDiscountAccountId_fkey";

-- RenameForeignKey
ALTER TABLE "AccountingSettings" RENAME CONSTRAINT "AccountingSettings_expense_fkey" TO "AccountingSettings_defaultExpenseAccountId_fkey";

-- RenameForeignKey
ALTER TABLE "AccountingSettings" RENAME CONSTRAINT "AccountingSettings_mobile_fkey" TO "AccountingSettings_defaultMobileMoneyAccountId_fkey";

-- RenameForeignKey
ALTER TABLE "AccountingSettings" RENAME CONSTRAINT "AccountingSettings_receivable_fkey" TO "AccountingSettings_defaultGuestReceivableAccountId_fkey";

-- RenameForeignKey
ALTER TABLE "AccountingSettings" RENAME CONSTRAINT "AccountingSettings_room_fkey" TO "AccountingSettings_defaultRoomRevenueAccountId_fkey";

-- RenameForeignKey
ALTER TABLE "AccountingSettings" RENAME CONSTRAINT "AccountingSettings_service_fkey" TO "AccountingSettings_defaultServiceRevenueAccountId_fkey";

-- RenameForeignKey
ALTER TABLE "AccountingSettings" RENAME CONSTRAINT "AccountingSettings_tax_fkey" TO "AccountingSettings_defaultTaxPayableAccountId_fkey";

-- AddForeignKey
ALTER TABLE "FiscalPeriod" ADD CONSTRAINT "FiscalPeriod_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
