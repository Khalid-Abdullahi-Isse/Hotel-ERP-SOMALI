import type { RequestUser } from '../../auth/auth.types.js';
import { AuditLogsService } from '../../audit-logs/audit-logs.service.js';
import { PaymentsService } from '../../payments/payments.service.js';
import { ReservationsService } from '../../reservations/reservations.service.js';
import { RoomsService } from '../../rooms/rooms.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AvailabilityService } from '../../availability/availability.service.js';
import type { ChargesService } from '../../charges/charges.service.js';

jest.mock('../../generated/prisma/client.js', () => ({ Prisma: {} }));
jest.mock('../../prisma/prisma.service.js', () => ({ PrismaService: class {} }));
jest.mock('../../generated/prisma/enums.js', () => ({
  ReservationStatus: { PENDING: 'PENDING', CONFIRMED: 'CONFIRMED', CHECKED_IN: 'CHECKED_IN', CHECKED_OUT: 'CHECKED_OUT', CANCELLED: 'CANCELLED', NO_SHOW: 'NO_SHOW' },
  RoomStatus: { AVAILABLE: 'AVAILABLE', RESERVED: 'RESERVED', OCCUPIED: 'OCCUPIED', DIRTY: 'DIRTY', CLEANING: 'CLEANING', MAINTENANCE: 'MAINTENANCE' },
  InvoiceStatus: { DRAFT: 'DRAFT', ISSUED: 'ISSUED', PARTIALLY_PAID: 'PARTIALLY_PAID', PAID: 'PAID', VOIDED: 'VOIDED' },
  PaymentKind: { PAYMENT: 'PAYMENT', REFUND: 'REFUND' },
  PaymentStatus: { COMPLETED: 'COMPLETED', VOIDED: 'VOIDED' },
}));

interface QueryCall { where: Record<string, unknown>; skip: number; take: number }

const actor: RequestUser = {
  id: '10000000-0000-4000-8000-000000000001',
  hotelId: '20000000-0000-4000-8000-000000000002',
  sessionId: '30000000-0000-4000-8000-000000000003',
  email: 'manager@example.com',
  username: 'manager',
  fullName: 'Hotel Manager',
  roles: ['MANAGER'],
  permissions: [],
};

function database(delegateName: 'reservation' | 'room' | 'auditLog' | 'payment', total: number) {
  const delegate = { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(total) };
  const prisma = {
    [delegateName]: delegate,
    $transaction: jest.fn((operations: Array<Promise<unknown>>) => Promise.all(operations)),
  } as unknown as PrismaService;
  return { prisma, delegate };
}

describe('representative paginated modules', () => {
  const audits = {} as AuditLogsService;

  it('scopes and filters reservations before applying page 2', async () => {
    const { prisma, delegate } = database('reservation', 7);
    const service = new ReservationsService(prisma, {} as AvailabilityService, audits);
    const result = await service.list({ page: 2, limit: 30, search: 'Ahmed', status: 'CONFIRMED' }, actor);
    const call = (delegate.findMany.mock.calls as unknown as Array<[QueryCall]>)[0][0];
    expect(call.where).toMatchObject({ hotelId: actor.hotelId, status: 'CONFIRMED' });
    expect(Array.isArray(call.where.OR)).toBe(true);
    expect(call).toMatchObject({ skip: 30, take: 30 });
    expect(result.pagination.total).toBe(7);
  });

  it('scopes and filters rooms before pagination', async () => {
    const { prisma, delegate } = database('room', 4);
    const service = new RoomsService(prisma, audits);
    const result = await service.list({ page: 1, limit: 30, search: '2', status: 'AVAILABLE' }, actor);
    const call = (delegate.findMany.mock.calls as unknown as Array<[QueryCall]>)[0][0];
    expect(call.where).toMatchObject({ hotelId: actor.hotelId, status: 'AVAILABLE' });
    expect(call).toMatchObject({ skip: 0, take: 30 });
    expect(result.pagination).toMatchObject({ total: 4, totalPages: 1 });
  });

  it('keeps audit-log counts hotel-scoped and filtered', async () => {
    const { prisma, delegate } = database('auditLog', 61);
    const service = new AuditLogsService(prisma);
    const result = await service.list({ page: 3, limit: 30, action: 'reservation.update' }, actor);
    expect(delegate.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { hotelId: actor.hotelId, action: 'reservation.update' },
      skip: 60,
      take: 30,
    }));
    expect(result.pagination).toMatchObject({ total: 61, totalPages: 3, hasNextPage: false });
  });

  it('searches and counts payments inside the authenticated hotel', async () => {
    const { prisma, delegate } = database('payment', 12);
    const service = new PaymentsService(prisma, {} as ChargesService, audits);
    const result = await service.list({ page: 1, limit: 30, search: 'Ahmed' }, actor);
    const call = (delegate.findMany.mock.calls as unknown as Array<[QueryCall]>)[0][0];
    expect(call.where.hotelId).toBe(actor.hotelId);
    expect(Array.isArray(call.where.OR)).toBe(true);
    expect(call.take).toBe(30);
    expect(result.pagination.total).toBe(12);
  });
});
