import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import type { RequestUser } from '../auth/auth.types.js';
import { paginatedResponse, paginationOffset } from '../common/pagination/pagination.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateGuestDto } from './dto/create-guest.dto.js';
import type { ListGuestsQueryDto } from './dto/list-guests-query.dto.js';
import type { UpdateGuestDto } from './dto/update-guest.dto.js';

@Injectable()
export class GuestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async create(dto: CreateGuestDto, actor: RequestUser) {
    return this.prisma.$transaction((transaction) =>
      this.createInTransaction(dto, actor, transaction),
    );
  }

  async createInTransaction(
    dto: CreateGuestDto,
    actor: RequestUser,
    transaction: Prisma.TransactionClient,
  ) {
    const { allowPossibleDuplicate, ...input } = dto;
    const normalizedPhone = this.normalizePhone(input.phone);
    const normalizedEmail = input.email?.trim().toLowerCase() || null;
    await this.assertNoStrongDuplicate(
      actor.hotelId,
      input.passportNumber,
      input.nationalId,
      undefined,
      transaction,
    );
    const possibleDuplicates = await this.findPossibleDuplicates(
      actor.hotelId,
      normalizedPhone,
      normalizedEmail,
      transaction,
    );
    if (possibleDuplicates.length > 0 && !allowPossibleDuplicate) {
      throw new ConflictException({
        code: 'POSSIBLE_DUPLICATE_GUEST',
        message: 'A guest with the same phone or email may already exist.',
        details: { candidates: possibleDuplicates },
      });
    }

    const guest = await transaction.guest.create({
        data: {
          ...input,
          hotelId: actor.hotelId,
          normalizedPhone,
          normalizedEmail,
        },
      });
      await this.auditLogs.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action:
            possibleDuplicates.length > 0 ? 'guest.create_duplicate_override' : 'guest.create',
          entityType: 'Guest',
          entityId: guest.id,
          newValue: this.auditView(guest),
        },
        transaction,
      );
    return guest;
  }

  async list(query: ListGuestsQueryDto, actor: RequestUser) {
    const search = query.search?.trim();
    const normalizedSearchPhone = search ? this.normalizePhone(search) : null;
    const where: Prisma.GuestWhereInput = {
      hotelId: actor.hotelId,
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { normalizedPhone: { contains: normalizedSearchPhone ?? search } },
              { normalizedEmail: { contains: search.toLowerCase() } },
              { passportNumber: { contains: search, mode: 'insensitive' } },
              { nationalId: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [guests, total] = await this.prisma.$transaction([
      this.prisma.guest.findMany({
        where,
        orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
        skip: paginationOffset(query.page, query.limit),
        take: query.limit,
      }),
      this.prisma.guest.count({ where }),
    ]);
    return paginatedResponse(guests, query.page, query.limit, total);
  }

  async findOne(id: string, actor: RequestUser) {
    return this.findHotelGuest(id, actor.hotelId);
  }

  async update(id: string, dto: UpdateGuestDto, actor: RequestUser) {
    const before = await this.findHotelGuest(id, actor.hotelId);
    await this.assertNoStrongDuplicate(actor.hotelId, dto.passportNumber, dto.nationalId, id);
    const guest = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.guest.update({
        where: { id },
        data: {
          ...dto,
          ...(dto.phone !== undefined ? { normalizedPhone: this.normalizePhone(dto.phone) } : {}),
          ...(dto.email !== undefined
            ? { normalizedEmail: dto.email?.trim().toLowerCase() || null }
            : {}),
        },
      });
      await this.auditLogs.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'guest.update',
          entityType: 'Guest',
          entityId: id,
          oldValue: this.auditView(before),
          newValue: this.auditView(updated),
        },
        transaction,
      );
      return updated;
    });
    return guest;
  }

  private async assertNoStrongDuplicate(
    hotelId: string,
    passportNumber?: string,
    nationalId?: string,
    excludedId?: string,
    database: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    if (!passportNumber && !nationalId) return;
    const duplicate = await database.guest.findFirst({
      where: {
        hotelId,
        ...(excludedId ? { id: { not: excludedId } } : {}),
        OR: [
          ...(passportNumber
            ? [{ passportNumber: { equals: passportNumber, mode: 'insensitive' as const } }]
            : []),
          ...(nationalId
            ? [{ nationalId: { equals: nationalId, mode: 'insensitive' as const } }]
            : []),
        ],
      },
      select: { id: true, fullName: true },
    });
    if (duplicate) {
      throw new ConflictException({
        code: 'GUEST_IDENTIFIER_EXISTS',
        message: 'A guest with this passport or national ID already exists.',
        details: { guestId: duplicate.id, fullName: duplicate.fullName },
      });
    }
  }

  private findPossibleDuplicates(
    hotelId: string,
    phone: string | null,
    email: string | null,
    database: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    if (!phone && !email) return Promise.resolve([]);
    return database.guest.findMany({
      where: {
        hotelId,
        OR: [
          ...(phone ? [{ normalizedPhone: phone }] : []),
          ...(email ? [{ normalizedEmail: email }] : []),
        ],
      },
      select: { id: true, fullName: true, phone: true, email: true },
      take: 5,
      orderBy: { createdAt: 'desc' },
    });
  }

  private async findHotelGuest(id: string, hotelId: string) {
    const guest = await this.prisma.guest.findFirst({ where: { id, hotelId } });
    if (!guest) {
      throw new NotFoundException({ code: 'GUEST_NOT_FOUND', message: 'Guest was not found.' });
    }
    return guest;
  }

  private normalizePhone(value?: string | null): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    const prefix = trimmed.startsWith('+') ? '+' : '';
    const digits = trimmed.replace(/\D/g, '');
    if (!digits) return null;
    if (digits.startsWith('00')) return `+${digits.slice(2)}`;
    return `${prefix}${digits}`;
  }

  private auditView(guest: {
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
    passportNumber: string | null;
    nationalId: string | null;
  }): Prisma.InputJsonObject {
    return {
      id: guest.id,
      fullName: guest.fullName,
      phone: guest.phone,
      email: guest.email,
      passportLast4: guest.passportNumber?.slice(-4) ?? null,
      nationalIdLast4: guest.nationalId?.slice(-4) ?? null,
    };
  }
}
