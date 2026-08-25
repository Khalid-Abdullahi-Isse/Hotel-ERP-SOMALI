import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import type { RequestUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { UpdateHotelDto } from './dto/update-hotel.dto.js';

const HOTEL_SELECT = {
  id: true,
  code: true,
  name: true,
  phone: true,
  email: true,
  address: true,
  currencyCode: true,
  timezone: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class HotelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async current(actor: RequestUser) {
    const hotel = await this.prisma.hotel.findUnique({
      where: { id: actor.hotelId },
      select: HOTEL_SELECT,
    });
    if (!hotel) {
      throw new NotFoundException({ code: 'HOTEL_NOT_FOUND', message: 'Hotel was not found.' });
    }
    return hotel;
  }

  async context(actor: RequestUser) {
    const hotel = await this.prisma.hotel.findUnique({
      where: { id: actor.hotelId },
      select: { id: true, name: true, currencyCode: true, timezone: true },
    });
    if (!hotel) {
      throw new NotFoundException({ code: 'HOTEL_NOT_FOUND', message: 'Hotel was not found.' });
    }
    return hotel;
  }

  async update(dto: UpdateHotelDto, actor: RequestUser) {
    const before = await this.current(actor);
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.hotel.update({
        where: { id: actor.hotelId },
        data: dto,
        select: HOTEL_SELECT,
      });
      await this.auditLogs.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'hotel.update',
          entityType: 'Hotel',
          entityId: actor.hotelId,
          oldValue: this.json(before),
          newValue: this.json(updated),
        },
        transaction,
      );
      return updated;
    });
  }

  private json(value: unknown): Prisma.InputJsonObject {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
  }
}
