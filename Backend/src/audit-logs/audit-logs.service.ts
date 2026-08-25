import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import type { RequestUser } from '../auth/auth.types.js';
import { paginatedResponse, paginationOffset } from '../common/pagination/pagination.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ListAuditQueryDto } from './dto/list-audit-query.dto.js';

export interface AuditEntry {
  hotelId: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry, transaction?: Prisma.TransactionClient): Promise<void> {
    const database = transaction ?? this.prisma;
    await database.auditLog.create({
      data: {
        hotelId: entry.hotelId,
        userId: entry.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        oldValue: entry.oldValue,
        newValue: entry.newValue,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent?.slice(0, 512),
      },
    });
  }

  async list(query: ListAuditQueryDto, actor: RequestUser) {
    const where = {
      hotelId: actor.hotelId,
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, fullName: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: paginationOffset(query.page, query.limit),
        take: query.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginatedResponse(data, query.page, query.limit, total);
  }

  async find(id: string, actor: RequestUser) {
    const value = await this.prisma.auditLog.findFirst({
      where: { id, hotelId: actor.hotelId },
      include: { user: { select: { id: true, fullName: true } } },
    });
    if (!value)
      throw new NotFoundException({
        code: 'AUDIT_LOG_NOT_FOUND',
        message: 'Audit log was not found.',
      });
    return value;
  }
}
