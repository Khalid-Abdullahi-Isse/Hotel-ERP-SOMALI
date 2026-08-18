-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'LOCKED');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'OCCUPIED', 'DIRTY', 'CLEANING', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "ChargeType" AS ENUM ('ROOM', 'SERVICE', 'DISCOUNT', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('PAYMENT', 'REFUND');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('COMPLETED', 'VOIDED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'PARTIALLY_PAID', 'VOIDED');

-- CreateEnum
CREATE TYPE "HousekeepingStatus" AS ENUM ('DIRTY', 'CLEANING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE');

-- CreateTable
CREATE TABLE "Hotel" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "phone" VARCHAR(32),
    "email" VARCHAR(254),
    "address" TEXT,
    "currencyCode" CHAR(3) NOT NULL DEFAULT 'USD',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Africa/Mogadishu',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Hotel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotelId" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "username" VARCHAR(64) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "fullName" VARCHAR(160) NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMPTZ(3),
    "lastLoginAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotelId" UUID NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(96) NOT NULL,
    "description" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "tokenHash" VARCHAR(255) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "replacedBy" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Floor" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotelId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "name" VARCHAR(80),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Floor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomType" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotelId" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "capacityAdults" INTEGER NOT NULL,
    "capacityChildren" INTEGER NOT NULL DEFAULT 0,
    "basePrice" DECIMAL(14,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RoomType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotelId" UUID NOT NULL,
    "floorId" UUID,
    "roomTypeId" UUID NOT NULL,
    "roomNumber" VARCHAR(32) NOT NULL,
    "status" "RoomStatus" NOT NULL DEFAULT 'AVAILABLE',
    "priceOverride" DECIMAL(14,2),
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guest" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotelId" UUID NOT NULL,
    "fullName" VARCHAR(160) NOT NULL,
    "phone" VARCHAR(32),
    "normalizedPhone" VARCHAR(32),
    "email" VARCHAR(254),
    "normalizedEmail" VARCHAR(254),
    "passportNumber" VARCHAR(64),
    "nationalId" VARCHAR(64),
    "nationality" VARCHAR(80),
    "address" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotelId" UUID NOT NULL,
    "guestId" UUID NOT NULL,
    "bookingNumber" VARCHAR(40) NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
    "checkInDate" DATE NOT NULL,
    "checkOutDate" DATE NOT NULL,
    "adults" INTEGER NOT NULL DEFAULT 1,
    "children" INTEGER NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "cancelledAt" TIMESTAMPTZ(3),
    "cancellationNote" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationRoom" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reservationId" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "checkInDate" DATE NOT NULL,
    "checkOutDate" DATE NOT NULL,
    "nightlyRate" DECIMAL(14,2) NOT NULL,
    "bookingStatus" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ReservationRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationHistory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reservationId" UUID NOT NULL,
    "fromStatus" "ReservationStatus",
    "toStatus" "ReservationStatus" NOT NULL,
    "note" TEXT,
    "changedById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotelId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "defaultPrice" DECIMAL(14,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Charge" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reservationId" UUID NOT NULL,
    "serviceId" UUID,
    "type" "ChargeType" NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "chargeDate" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Charge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotelId" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotelId" UUID NOT NULL,
    "reservationId" UUID,
    "invoiceId" UUID,
    "guestId" UUID,
    "paymentMethodId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "kind" "PaymentKind" NOT NULL DEFAULT 'PAYMENT',
    "status" "PaymentStatus" NOT NULL DEFAULT 'COMPLETED',
    "amount" DECIMAL(14,2) NOT NULL,
    "reference" VARCHAR(120),
    "note" TEXT,
    "originalPaymentId" UUID,
    "paidAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotelId" UUID NOT NULL,
    "reservationId" UUID NOT NULL,
    "invoiceNumber" VARCHAR(40) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "issuedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "invoiceId" UUID NOT NULL,
    "chargeId" UUID,
    "description" VARCHAR(255) NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotelId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotelId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "paymentMethodId" UUID,
    "createdById" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "expenseDate" DATE NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "reference" VARCHAR(120),
    "reversedAt" TIMESTAMPTZ(3),
    "reversalReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HousekeepingTask" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotelId" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "assignedToId" UUID,
    "status" "HousekeepingStatus" NOT NULL DEFAULT 'DIRTY',
    "notes" TEXT,
    "startedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "HousekeepingTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceRequest" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotelId" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "assignedToId" UUID,
    "problem" TEXT NOT NULL,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'OPEN',
    "cost" DECIMAL(14,2),
    "notes" TEXT,
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "MaintenanceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotelId" UUID NOT NULL,
    "userId" UUID,
    "action" VARCHAR(96) NOT NULL,
    "entityType" VARCHAR(80) NOT NULL,
    "entityId" UUID NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ipAddress" INET,
    "userAgent" VARCHAR(512),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Hotel_code_key" ON "Hotel"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_hotelId_status_idx" ON "User"("hotelId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Role_hotelId_name_key" ON "Role"("hotelId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_expiresAt_idx" ON "RefreshToken"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Floor_hotelId_number_key" ON "Floor"("hotelId", "number");

-- CreateIndex
CREATE INDEX "RoomType_hotelId_isActive_idx" ON "RoomType"("hotelId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "RoomType_hotelId_code_key" ON "RoomType"("hotelId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "RoomType_hotelId_name_key" ON "RoomType"("hotelId", "name");

-- CreateIndex
CREATE INDEX "Room_hotelId_status_isActive_idx" ON "Room"("hotelId", "status", "isActive");

-- CreateIndex
CREATE INDEX "Room_hotelId_roomTypeId_status_idx" ON "Room"("hotelId", "roomTypeId", "status");

-- CreateIndex
CREATE INDEX "Room_floorId_idx" ON "Room"("floorId");

-- CreateIndex
CREATE UNIQUE INDEX "Room_hotelId_roomNumber_key" ON "Room"("hotelId", "roomNumber");

-- CreateIndex
CREATE INDEX "Guest_hotelId_fullName_idx" ON "Guest"("hotelId", "fullName");

-- CreateIndex
CREATE INDEX "Guest_hotelId_createdAt_idx" ON "Guest"("hotelId", "createdAt");

-- CreateIndex
CREATE INDEX "Reservation_hotelId_status_checkInDate_idx" ON "Reservation"("hotelId", "status", "checkInDate");

-- CreateIndex
CREATE INDEX "Reservation_hotelId_status_checkOutDate_idx" ON "Reservation"("hotelId", "status", "checkOutDate");

-- CreateIndex
CREATE INDEX "Reservation_guestId_createdAt_idx" ON "Reservation"("guestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_hotelId_bookingNumber_key" ON "Reservation"("hotelId", "bookingNumber");

-- CreateIndex
CREATE INDEX "ReservationRoom_roomId_checkInDate_checkOutDate_idx" ON "ReservationRoom"("roomId", "checkInDate", "checkOutDate");

-- CreateIndex
CREATE INDEX "ReservationRoom_reservationId_idx" ON "ReservationRoom"("reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "ReservationRoom_reservationId_roomId_key" ON "ReservationRoom"("reservationId", "roomId");

-- CreateIndex
CREATE INDEX "ReservationHistory_reservationId_createdAt_idx" ON "ReservationHistory"("reservationId", "createdAt");

-- CreateIndex
CREATE INDEX "Service_hotelId_isActive_idx" ON "Service"("hotelId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Service_hotelId_name_key" ON "Service"("hotelId", "name");

-- CreateIndex
CREATE INDEX "Charge_reservationId_chargeDate_idx" ON "Charge"("reservationId", "chargeDate");

-- CreateIndex
CREATE INDEX "Charge_serviceId_idx" ON "Charge"("serviceId");

-- CreateIndex
CREATE INDEX "PaymentMethod_hotelId_isActive_idx" ON "PaymentMethod"("hotelId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_hotelId_name_key" ON "PaymentMethod"("hotelId", "name");

-- CreateIndex
CREATE INDEX "Payment_hotelId_paidAt_idx" ON "Payment"("hotelId", "paidAt");

-- CreateIndex
CREATE INDEX "Payment_reservationId_paidAt_idx" ON "Payment"("reservationId", "paidAt");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX "Payment_guestId_idx" ON "Payment"("guestId");

-- CreateIndex
CREATE INDEX "Payment_originalPaymentId_idx" ON "Payment"("originalPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_reservationId_key" ON "Invoice"("reservationId");

-- CreateIndex
CREATE INDEX "Invoice_hotelId_status_issuedAt_idx" ON "Invoice"("hotelId", "status", "issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_hotelId_invoiceNumber_key" ON "Invoice"("hotelId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceItem_chargeId_idx" ON "InvoiceItem"("chargeId");

-- CreateIndex
CREATE INDEX "ExpenseCategory_hotelId_isActive_idx" ON "ExpenseCategory"("hotelId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_hotelId_name_key" ON "ExpenseCategory"("hotelId", "name");

-- CreateIndex
CREATE INDEX "Expense_hotelId_expenseDate_idx" ON "Expense"("hotelId", "expenseDate");

-- CreateIndex
CREATE INDEX "Expense_categoryId_expenseDate_idx" ON "Expense"("categoryId", "expenseDate");

-- CreateIndex
CREATE INDEX "Expense_paymentMethodId_idx" ON "Expense"("paymentMethodId");

-- CreateIndex
CREATE INDEX "HousekeepingTask_hotelId_status_createdAt_idx" ON "HousekeepingTask"("hotelId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "HousekeepingTask_roomId_status_idx" ON "HousekeepingTask"("roomId", "status");

-- CreateIndex
CREATE INDEX "HousekeepingTask_assignedToId_status_idx" ON "HousekeepingTask"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_hotelId_status_createdAt_idx" ON "MaintenanceRequest"("hotelId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_roomId_status_idx" ON "MaintenanceRequest"("roomId", "status");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_assignedToId_status_idx" ON "MaintenanceRequest"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "AuditLog_hotelId_createdAt_idx" ON "AuditLog"("hotelId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Floor" ADD CONSTRAINT "Floor_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomType" ADD CONSTRAINT "RoomType_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationRoom" ADD CONSTRAINT "ReservationRoom_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationRoom" ADD CONSTRAINT "ReservationRoom_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationHistory" ADD CONSTRAINT "ReservationHistory_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationHistory" ADD CONSTRAINT "ReservationHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_originalPaymentId_fkey" FOREIGN KEY ("originalPaymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "Charge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PostgreSQL-native integrity rules that Prisma Schema Language cannot represent.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Core value checks.
ALTER TABLE "Hotel"
  ADD CONSTRAINT "Hotel_code_not_blank" CHECK (btrim("code") <> ''),
  ADD CONSTRAINT "Hotel_currency_code_format" CHECK ("currencyCode" ~ '^[A-Z]{3}$');

ALTER TABLE "User"
  ADD CONSTRAINT "User_email_canonical" CHECK ("email" = lower(btrim("email"))),
  ADD CONSTRAINT "User_username_canonical" CHECK ("username" = lower(btrim("username"))),
  ADD CONSTRAINT "User_failed_login_attempts_nonnegative" CHECK ("failedLoginAttempts" >= 0);

ALTER TABLE "RoomType"
  ADD CONSTRAINT "RoomType_adult_capacity_positive" CHECK ("capacityAdults" > 0),
  ADD CONSTRAINT "RoomType_child_capacity_nonnegative" CHECK ("capacityChildren" >= 0),
  ADD CONSTRAINT "RoomType_base_price_nonnegative" CHECK ("basePrice" >= 0);

ALTER TABLE "Room"
  ADD CONSTRAINT "Room_number_not_blank" CHECK (btrim("roomNumber") <> ''),
  ADD CONSTRAINT "Room_price_override_nonnegative" CHECK ("priceOverride" IS NULL OR "priceOverride" >= 0);

ALTER TABLE "Guest"
  ADD CONSTRAINT "Guest_name_not_blank" CHECK (btrim("fullName") <> ''),
  ADD CONSTRAINT "Guest_phone_canonical" CHECK ("normalizedPhone" IS NULL OR "normalizedPhone" = btrim("normalizedPhone")),
  ADD CONSTRAINT "Guest_email_canonical" CHECK ("normalizedEmail" IS NULL OR "normalizedEmail" = lower(btrim("normalizedEmail")));

ALTER TABLE "Reservation"
  ADD CONSTRAINT "Reservation_dates_valid" CHECK ("checkOutDate" > "checkInDate"),
  ADD CONSTRAINT "Reservation_adults_positive" CHECK ("adults" >= 1),
  ADD CONSTRAINT "Reservation_children_nonnegative" CHECK ("children" >= 0),
  ADD CONSTRAINT "Reservation_discount_nonnegative" CHECK ("discountAmount" >= 0);

ALTER TABLE "ReservationRoom"
  ADD CONSTRAINT "ReservationRoom_dates_valid" CHECK ("checkOutDate" > "checkInDate"),
  ADD CONSTRAINT "ReservationRoom_nightly_rate_nonnegative" CHECK ("nightlyRate" >= 0);

ALTER TABLE "Service"
  ADD CONSTRAINT "Service_default_price_nonnegative" CHECK ("defaultPrice" >= 0);

ALTER TABLE "Charge"
  ADD CONSTRAINT "Charge_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "Charge_unit_price_nonnegative" CHECK ("unitPrice" >= 0),
  ADD CONSTRAINT "Charge_total_nonnegative" CHECK ("totalAmount" >= 0);

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_amount_positive" CHECK ("amount" > 0),
  ADD CONSTRAINT "Payment_refund_has_original" CHECK (
    ("kind" = 'PAYMENT' AND "originalPaymentId" IS NULL)
    OR ("kind" = 'REFUND' AND "originalPaymentId" IS NOT NULL)
  );

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_amounts_nonnegative" CHECK (
    "subtotal" >= 0 AND "discountAmount" >= 0 AND "totalAmount" >= 0
  ),
  ADD CONSTRAINT "Invoice_discount_not_above_subtotal" CHECK ("discountAmount" <= "subtotal"),
  ADD CONSTRAINT "Invoice_total_math" CHECK ("totalAmount" = "subtotal" - "discountAmount");

ALTER TABLE "InvoiceItem"
  ADD CONSTRAINT "InvoiceItem_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "InvoiceItem_unit_price_nonnegative" CHECK ("unitPrice" >= 0),
  ADD CONSTRAINT "InvoiceItem_amount_nonnegative" CHECK ("amount" >= 0);

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_amount_positive" CHECK ("amount" > 0),
  ADD CONSTRAINT "Expense_reversal_complete" CHECK (
    ("reversedAt" IS NULL AND "reversalReason" IS NULL)
    OR ("reversedAt" IS NOT NULL AND btrim("reversalReason") <> '')
  );

ALTER TABLE "MaintenanceRequest"
  ADD CONSTRAINT "Maintenance_cost_nonnegative" CHECK ("cost" IS NULL OR "cost" >= 0);

-- Strong duplicate prevention for government-issued identifiers. Phone and email
-- remain indexed lookup signals because families may legitimately share them.
CREATE UNIQUE INDEX "Guest_hotel_passport_unique"
  ON "Guest" ("hotelId", lower(btrim("passportNumber")))
  WHERE "passportNumber" IS NOT NULL AND btrim("passportNumber") <> '';
CREATE UNIQUE INDEX "Guest_hotel_national_id_unique"
  ON "Guest" ("hotelId", lower(btrim("nationalId")))
  WHERE "nationalId" IS NOT NULL AND btrim("nationalId") <> '';
CREATE INDEX "Guest_hotel_phone_lookup"
  ON "Guest" ("hotelId", "normalizedPhone") WHERE "normalizedPhone" IS NOT NULL;
CREATE INDEX "Guest_hotel_email_lookup"
  ON "Guest" ("hotelId", "normalizedEmail") WHERE "normalizedEmail" IS NOT NULL;

-- A reservation-room row derives its dates/status from its reservation and must
-- link a room belonging to the same hotel. Clients cannot bypass this by sending
-- a different bookingStatus or date range.
CREATE OR REPLACE FUNCTION enforce_reservation_room_integrity()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  reservation_hotel uuid;
  reservation_status "ReservationStatus";
  reservation_check_in date;
  reservation_check_out date;
  room_hotel uuid;
BEGIN
  SELECT "hotelId", "status", "checkInDate", "checkOutDate"
    INTO reservation_hotel, reservation_status, reservation_check_in, reservation_check_out
    FROM "Reservation" WHERE "id" = NEW."reservationId" FOR KEY SHARE;
  SELECT "hotelId" INTO room_hotel FROM "Room" WHERE "id" = NEW."roomId" FOR KEY SHARE;

  IF reservation_hotel IS NULL OR room_hotel IS NULL OR reservation_hotel <> room_hotel THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'reservation and room must belong to the same hotel';
  END IF;

  NEW."bookingStatus" := reservation_status;
  NEW."checkInDate" := reservation_check_in;
  NEW."checkOutDate" := reservation_check_out;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ReservationRoom_integrity"
BEFORE INSERT OR UPDATE ON "ReservationRoom"
FOR EACH ROW EXECUTE FUNCTION enforce_reservation_room_integrity();

CREATE OR REPLACE FUNCTION sync_reservation_room_status()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."status" IS DISTINCT FROM OLD."status"
     OR NEW."checkInDate" IS DISTINCT FROM OLD."checkInDate"
     OR NEW."checkOutDate" IS DISTINCT FROM OLD."checkOutDate" THEN
    UPDATE "ReservationRoom"
      SET "bookingStatus" = NEW."status",
          "checkInDate" = NEW."checkInDate",
          "checkOutDate" = NEW."checkOutDate",
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "reservationId" = NEW."id";
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Reservation_sync_rooms"
AFTER UPDATE OF "status", "checkInDate", "checkOutDate" ON "Reservation"
FOR EACH ROW EXECUTE FUNCTION sync_reservation_room_status();

-- PostgreSQL arbitrates concurrent overlapping writes. [) makes checkout on the
-- same date as the next check-in valid. Cancelled/no-show/checked-out rows do not block.
ALTER TABLE "ReservationRoom"
  ADD CONSTRAINT "ReservationRoom_no_active_overlap"
  EXCLUDE USING gist (
    "roomId" WITH =,
    daterange("checkInDate", "checkOutDate", '[)') WITH &&
  ) WHERE ("bookingStatus" IN ('PENDING', 'CONFIRMED', 'CHECKED_IN'));

-- Cross-entity hotel boundary protection for key tenant-owned workflows.
CREATE OR REPLACE FUNCTION enforce_tenant_links()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE linked_hotel uuid;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'Reservation' THEN
      SELECT "hotelId" INTO linked_hotel FROM "Guest" WHERE "id" = NEW."guestId";
    WHEN 'Invoice' THEN
      SELECT "hotelId" INTO linked_hotel FROM "Reservation" WHERE "id" = NEW."reservationId";
    WHEN 'Room' THEN
      SELECT "hotelId" INTO linked_hotel FROM "RoomType" WHERE "id" = NEW."roomTypeId";
    WHEN 'Expense' THEN
      SELECT "hotelId" INTO linked_hotel FROM "ExpenseCategory" WHERE "id" = NEW."categoryId";
    WHEN 'HousekeepingTask' THEN
      SELECT "hotelId" INTO linked_hotel FROM "Room" WHERE "id" = NEW."roomId";
    WHEN 'MaintenanceRequest' THEN
      SELECT "hotelId" INTO linked_hotel FROM "Room" WHERE "id" = NEW."roomId";
    WHEN 'Payment' THEN
      SELECT "hotelId" INTO linked_hotel FROM "PaymentMethod" WHERE "id" = NEW."paymentMethodId";
    ELSE
      RAISE EXCEPTION 'unsupported tenant-link table: %', TG_TABLE_NAME;
  END CASE;

  IF linked_hotel IS NULL OR linked_hotel <> NEW."hotelId" THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = TG_TABLE_NAME || ' contains a cross-hotel reference';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Reservation_tenant_links" BEFORE INSERT OR UPDATE ON "Reservation"
FOR EACH ROW EXECUTE FUNCTION enforce_tenant_links();
CREATE TRIGGER "Invoice_tenant_links" BEFORE INSERT OR UPDATE ON "Invoice"
FOR EACH ROW EXECUTE FUNCTION enforce_tenant_links();
CREATE TRIGGER "Room_tenant_links" BEFORE INSERT OR UPDATE ON "Room"
FOR EACH ROW EXECUTE FUNCTION enforce_tenant_links();
CREATE TRIGGER "Expense_tenant_links" BEFORE INSERT OR UPDATE ON "Expense"
FOR EACH ROW EXECUTE FUNCTION enforce_tenant_links();
CREATE TRIGGER "HousekeepingTask_tenant_links" BEFORE INSERT OR UPDATE ON "HousekeepingTask"
FOR EACH ROW EXECUTE FUNCTION enforce_tenant_links();
CREATE TRIGGER "MaintenanceRequest_tenant_links" BEFORE INSERT OR UPDATE ON "MaintenanceRequest"
FOR EACH ROW EXECUTE FUNCTION enforce_tenant_links();
CREATE TRIGGER "Payment_tenant_links" BEFORE INSERT OR UPDATE ON "Payment"
FOR EACH ROW EXECUTE FUNCTION enforce_tenant_links();

-- Audit records are append-only. The production application role must not own
-- these functions/tables so it cannot disable the trigger.
CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'audit logs are append-only';
END;
$$;

CREATE TRIGGER "AuditLog_append_only"
BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
