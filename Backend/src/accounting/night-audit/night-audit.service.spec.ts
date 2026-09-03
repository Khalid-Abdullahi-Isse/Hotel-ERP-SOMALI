import { ConflictException } from '@nestjs/common';

jest.mock('../../common/database/serializable-transaction.js', () => ({
  runSerializable: (prisma: unknown, fn: (tx: unknown) => unknown) => fn(prisma),
}));

jest.mock('../../audit-logs/audit-logs.service.js', () => ({
  AuditLogsService: class {},
}));

jest.mock('../../prisma/prisma.service.js', () => ({
  PrismaService: class {},
}));

jest.mock('../guest-accounting.service.js', () => ({
  GuestAccountingService: class {},
}));

jest.mock('../../generated/prisma/client.js', () => ({
  Prisma: {
    Decimal: class Decimal {
      value: string;
      constructor(value: string | number) {
        this.value = String(value);
      }
      toString() {
        return this.value;
      }
      plus(other: string | number | Decimal) {
        return new Decimal(Number(this.value) + Number(other.toString ? other.toString() : other));
      }
    },
  },
}));

import { NightAuditService } from './night-audit.service.js';

describe('NightAuditService', () => {
  const actor = {
    id: '10000000-0000-4000-8000-000000000001',
    hotelId: '20000000-0000-4000-8000-000000000001',
    permissions: [],
  } as any;

  it('posts one room-night per reservation room per business date and totals the day', async () => {
    const reservationRooms = [
      {
        id: 'room-1',
        reservationId: 'res-1',
        roomId: 'r-1',
        checkInDate: new Date('2026-09-10T00:00:00.000Z'),
        checkOutDate: new Date('2026-09-13T00:00:00.000Z'),
        nightlyRate: '120.00',
        room: { id: 'r-1', roomNumber: '101' },
        reservation: { id: 'res-1', status: 'CHECKED_IN' },
      },
      {
        id: 'room-2',
        reservationId: 'res-2',
        roomId: 'r-2',
        checkInDate: new Date('2026-09-11T00:00:00.000Z'),
        checkOutDate: new Date('2026-09-14T00:00:00.000Z'),
        nightlyRate: '110.00',
        room: { id: 'r-2', roomNumber: '102' },
        reservation: { id: 'res-2', status: 'CHECKED_IN' },
      },
    ];

    const guestAccounting = {
      postCharge: jest.fn().mockResolvedValue({ accountingEnabled: true }),
    };
    const prisma = {
      reservationRoom: {
        findMany: jest.fn().mockResolvedValue(reservationRooms),
      },
      reservationRoomNight: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }) => ({ id: data.reservationRoomId, ...data })),
      },
      hotelBusinessDate: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'business-date-1',
          hotelId: actor.hotelId,
          businessDate: '2026-09-12',
            status: 'OPEN',
        }),
        update: jest.fn().mockResolvedValue({
          id: 'business-date-1',
          hotelId: actor.hotelId,
          businessDate: '2026-09-12',
          status: 'POSTED',
          totalRoomRevenue: '230.00',
          roomNights: 2,
        }),
      },
    };

    const service = new NightAuditService(prisma as any, { record: jest.fn() } as any, guestAccounting as any);

    const result = await service.postBusinessDate(actor.hotelId, '2026-09-12', actor);

    expect(prisma.reservationRoomNight.create).toHaveBeenCalledTimes(2);
    expect(guestAccounting.postCharge).toHaveBeenCalledTimes(2);
    expect(result.totalRoomRevenue).toBe('230.00');
    expect(result.roomNights).toBe(2);
    expect(result.status).toBe('POSTED');
  });

  it('rejects a date advance when a previous business date is not closed', async () => {
    const prisma = {
      hotelBusinessDate: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'prior-business-date',
          hotelId: actor.hotelId,
          businessDate: '2026-09-11',
          status: 'OPEN',
        }),
      },
    };

    const service = new NightAuditService(prisma as any, { record: jest.fn() } as any, { postCharge: jest.fn() } as any);

    await expect(service.advanceBusinessDate(actor.hotelId, '2026-09-12', actor)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
