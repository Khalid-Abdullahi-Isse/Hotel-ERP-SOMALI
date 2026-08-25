import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { AuditLogsService } from '../../audit-logs/audit-logs.service.js';
import type { RequestUser } from '../../auth/auth.types.js';
import { paginatedResponse, paginationOffset } from '../../common/pagination/pagination.util.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateAccountDto } from './dto/create-account.dto.js';
import type { ListAccountsQueryDto } from './dto/list-accounts-query.dto.js';
import type { UpdateAccountDto } from './dto/update-account.dto.js';

const ACCOUNT_INCLUDE = {
  parent: { select: { id: true, code: true, name: true } },
  _count: { select: { children: true, journalLines: true } },
} as const;

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audits: AuditLogsService,
  ) {}

  async list(query: ListAccountsQueryDto, actor: RequestUser) {
    const search = query.search?.trim();
    const where: Prisma.AccountWhereInput = {
      hotelId: actor.hotelId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.isActive ? { isActive: query.isActive === 'true' } : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.account.findMany({
        where,
        include: ACCOUNT_INCLUDE,
        orderBy: [{ code: 'asc' }, { id: 'asc' }],
        skip: paginationOffset(query.page, query.limit),
        take: query.limit,
      }),
      this.prisma.account.count({ where }),
    ]);
    return paginatedResponse(data, query.page, query.limit, total);
  }

  async find(id: string, actor: RequestUser) {
    const account = await this.prisma.account.findFirst({
      where: { id, hotelId: actor.hotelId },
      include: ACCOUNT_INCLUDE,
    });
    if (!account) this.notFound();
    return account;
  }

  async create(dto: CreateAccountDto, actor: RequestUser) {
    return this.prisma.$transaction(async (tx) => {
      const hotel = await tx.hotel.findUniqueOrThrow({
        where: { id: actor.hotelId },
        select: { currencyCode: true },
      });
      await this.validateParent(tx, dto.parentAccountId, actor.hotelId, dto.type);
      const account = await tx.account.create({
        data: {
          hotelId: actor.hotelId,
          code: dto.code,
          name: dto.name,
          type: dto.type,
          subType: dto.subType?.trim(),
          normalBalance: dto.normalBalance,
          parentAccountId: dto.parentAccountId,
          currency: hotel.currencyCode,
          isActive: dto.isActive,
          allowManualPosting: dto.allowManualPosting,
        },
        include: ACCOUNT_INCLUDE,
      });
      await this.audits.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'accounting.account_created',
          entityType: 'Account',
          entityId: account.id,
          newValue: this.json(account),
        },
        tx,
      );
      return account;
    });
  }

  async update(id: string, dto: UpdateAccountDto, actor: RequestUser) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.account.findFirst({ where: { id, hotelId: actor.hotelId } });
      if (!existing) this.notFound();
      const nextType = dto.type ?? existing.type;
      if (dto.parentAccountId === id) this.invalidParent();
      await this.validateParent(tx, dto.parentAccountId, actor.hotelId, nextType, id);

      const changesStructure =
        (dto.type !== undefined && dto.type !== existing.type) ||
        (dto.normalBalance !== undefined && dto.normalBalance !== existing.normalBalance);
      if (changesStructure) {
        const [postedLines, children] = await Promise.all([
          tx.journalLine.count({
            where: { accountId: id, journalEntry: { status: { not: 'DRAFT' } } },
          }),
          tx.account.count({ where: { parentAccountId: id } }),
        ]);
        if (postedLines > 0 || children > 0) {
          throw new ConflictException({
            code: 'ACCOUNT_STRUCTURE_IMMUTABLE',
            message:
              'An account with posted activity or child accounts cannot change accounting type.',
          });
        }
      }

      const updated = await tx.account.update({
        where: { id },
        data: {
          code: dto.code,
          name: dto.name,
          type: dto.type,
          subType: dto.subType?.trim(),
          normalBalance: dto.normalBalance,
          parentAccountId: dto.parentAccountId,
          isActive: dto.isActive,
          allowManualPosting: dto.allowManualPosting,
        },
        include: ACCOUNT_INCLUDE,
      });
      await this.audits.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'accounting.account_updated',
          entityType: 'Account',
          entityId: id,
          oldValue: this.json(existing),
          newValue: this.json(updated),
        },
        tx,
      );
      return updated;
    });
  }

  private async validateParent(
    tx: Prisma.TransactionClient,
    parentId: string | undefined,
    hotelId: string,
    type: string,
    accountId?: string,
  ) {
    if (!parentId) return;
    const parent = await tx.account.findFirst({
      where: { id: parentId, hotelId },
      select: { id: true, type: true, parentAccountId: true },
    });
    if (!parent || parent.type !== type) this.invalidParent();
    let current = parent;
    while (current.parentAccountId) {
      if (current.id === accountId || current.parentAccountId === accountId) this.invalidParent();
      const ancestor = await tx.account.findFirst({
        where: { id: current.parentAccountId, hotelId },
        select: { id: true, type: true, parentAccountId: true },
      });
      if (!ancestor || ancestor.type !== type) this.invalidParent();
      current = ancestor;
    }
  }

  private invalidParent(): never {
    throw new ConflictException({
      code: 'INVALID_ACCOUNT_PARENT',
      message: 'The parent must be a same-hotel account of the same type without creating a cycle.',
    });
  }

  private notFound(): never {
    throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND', message: 'Account was not found.' });
  }

  private json(value: unknown): Prisma.InputJsonObject {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
  }
}
