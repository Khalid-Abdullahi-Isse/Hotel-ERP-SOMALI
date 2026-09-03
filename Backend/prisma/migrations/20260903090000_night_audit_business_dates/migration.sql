-- CreateTable
CREATE TABLE "HotelBusinessDate" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotelId" UUID NOT NULL,
    "businessDate" DATE NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    "roomNights" INTEGER NOT NULL DEFAULT 0,
    "totalRoomRevenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "HotelBusinessDate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationRoomNight" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotelId" UUID NOT NULL,
    "reservationRoomId" UUID NOT NULL,
    "businessDate" DATE NOT NULL,
    "nightlyRate" DECIMAL(14,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'POSTED',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "ReservationRoomNight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HotelBusinessDate_hotelId_businessDate_key" ON "HotelBusinessDate"("hotelId", "businessDate");
CREATE INDEX "HotelBusinessDate_hotelId_businessDate_status_idx" ON "HotelBusinessDate"("hotelId", "businessDate", "status");
CREATE UNIQUE INDEX "ReservationRoomNight_hotelId_reservationRoomId_businessDate_key" ON "ReservationRoomNight"("hotelId", "reservationRoomId", "businessDate");
CREATE INDEX "ReservationRoomNight_hotelId_businessDate_status_idx" ON "ReservationRoomNight"("hotelId", "businessDate", "status");
CREATE INDEX "ReservationRoomNight_reservationRoomId_businessDate_idx" ON "ReservationRoomNight"("reservationRoomId", "businessDate");

-- AddForeignKey
ALTER TABLE "ReservationRoomNight" ADD CONSTRAINT "ReservationRoomNight_reservationRoomId_fkey" FOREIGN KEY ("reservationRoomId") REFERENCES "ReservationRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
