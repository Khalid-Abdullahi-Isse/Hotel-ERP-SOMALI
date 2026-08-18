import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { PERMISSIONS } from '../auth/auth.constants.js';
import type { RequestUser } from '../auth/auth.types.js';
import { runSerializable } from '../common/database/serializable-transaction.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateExpenseDto } from './dto/create-expense.dto.js';
import type { ExpenseCategoryDto } from './dto/expense-category.dto.js';
const INCLUDE = {
  hotel: { select: { currencyCode: true } },
  category: { select: { id: true, name: true } },
  paymentMethod: { select: { id: true, name: true } },
  createdBy: { select: { id: true, fullName: true } },
  reversedBy: { select: { id: true, fullName: true } },
} as const;
@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audits: AuditLogsService,
  ) {}
  async categories(actor: RequestUser) {
    const manage = actor.permissions.includes(PERMISSIONS.EXPENSE_CATEGORY_MANAGE);
    return this.prisma.expenseCategory.findMany({
      where: { hotelId: actor.hotelId, ...(manage ? {} : { isActive: true }) },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }
  category(
    id: string | undefined,
    dto: ExpenseCategoryDto | undefined,
    active: boolean | undefined,
    actor: RequestUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = id
        ? await tx.expenseCategory.findFirst({ where: { id, hotelId: actor.hotelId } })
        : undefined;
      if (id && !before) this.categoryNotFound();
      const value = id
        ? await tx.expenseCategory.update({
            where: { id },
            data: { ...dto, ...(active === undefined ? {} : { isActive: active }) },
          })
        : await tx.expenseCategory.create({ data: { hotelId: actor.hotelId, ...dto! } });
      await this.audits.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: !id
            ? 'expense_category.create'
            : active === false
              ? 'expense_category.deactivate'
              : active === true
                ? 'expense_category.restore'
                : 'expense_category.update',
          entityType: 'ExpenseCategory',
          entityId: value.id,
          ...(before ? { oldValue: this.json(before) } : {}),
          newValue: this.json(value),
        },
        tx,
      );
      return value;
    });
  }
  create(dto: CreateExpenseDto, actor: RequestUser) {
    return runSerializable(this.prisma, async (tx) => {
      const existing = await tx.expense.findFirst({
        where: { hotelId: actor.hotelId, requestKey: dto.requestKey },
        include: INCLUDE,
      });
      if (existing) {
        if (
          existing.categoryId !== dto.categoryId ||
          !existing.amount.eq(dto.amount) ||
          existing.expenseDate.toISOString().slice(0, 10) !== dto.expenseDate
        )
          throw new ConflictException({
            code: 'IDEMPOTENCY_KEY_REUSED',
            message: 'Request key was used for a different expense.',
          });
        return { idempotentReplay: true, expense: this.view(existing) };
      }
      const category = await tx.expenseCategory.findFirst({
        where: { id: dto.categoryId, hotelId: actor.hotelId, isActive: true },
      });
      if (!category) this.categoryNotFound();
      if (dto.paymentMethodId) {
        const method = await tx.paymentMethod.findFirst({
          where: { id: dto.paymentMethodId, hotelId: actor.hotelId, isActive: true },
        });
        if (!method)
          throw new ConflictException({
            code: 'PAYMENT_METHOD_NOT_AVAILABLE',
            message: 'Expense payment method is inactive or invalid.',
          });
      }
      const expense = await tx.expense.create({
        data: {
          hotelId: actor.hotelId,
          categoryId: dto.categoryId,
          paymentMethodId: dto.paymentMethodId,
          createdById: actor.id,
          requestKey: dto.requestKey,
          amount: dto.amount,
          expenseDate: new Date(`${dto.expenseDate}T00:00:00.000Z`),
          description: dto.description.trim(),
          reference: dto.reference?.trim(),
        },
        include: INCLUDE,
      });
      await this.audits.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'expense.create',
          entityType: 'Expense',
          entityId: expense.id,
          newValue: this.json(this.view(expense)),
        },
        tx,
      );
      return { idempotentReplay: false, expense: this.view(expense) };
    });
  }
  async list(actor: RequestUser) {
    const values = await this.prisma.expense.findMany({
      where: { hotelId: actor.hotelId },
      include: INCLUDE,
      orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
    });
    return values.map((v) => this.view(v));
  }
  async find(id: string, actor: RequestUser) {
    const value = await this.prisma.expense.findFirst({
      where: { id, hotelId: actor.hotelId },
      include: INCLUDE,
    });
    if (!value) this.notFound();
    return this.view(value);
  }
  reverse(id: string, reason: string, actor: RequestUser) {
    return runSerializable(this.prisma, async (tx) => {
      const locked = await tx.$queryRaw<
        Array<{ id: string }>
      >`SELECT "id" FROM "Expense" WHERE "id"=${id}::uuid AND "hotelId"=${actor.hotelId}::uuid FOR UPDATE`;
      if (locked.length !== 1) this.notFound();
      const before = await tx.expense.findUniqueOrThrow({ where: { id } });
      if (before.reversedAt)
        return this.view(await tx.expense.findUniqueOrThrow({ where: { id }, include: INCLUDE }));
      const value = await tx.expense.update({
        where: { id },
        data: { reversedAt: new Date(), reversedById: actor.id, reversalReason: reason.trim() },
        include: INCLUDE,
      });
      await this.audits.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'expense.reverse',
          entityType: 'Expense',
          entityId: id,
          oldValue: { reversedAt: null },
          newValue: { reversedAt: value.reversedAt?.toISOString(), reason: value.reversalReason },
        },
        tx,
      );
      return this.view(value);
    });
  }
  private view<T extends { amount: Prisma.Decimal; expenseDate: Date }>(v: T) {
    return {
      ...v,
      amount: v.amount.toString(),
      expenseDate: v.expenseDate.toISOString().slice(0, 10),
      reversed: 'reversedAt' in v && Boolean(v.reversedAt),
    };
  }
  private notFound(): never {
    throw new NotFoundException({ code: 'EXPENSE_NOT_FOUND', message: 'Expense was not found.' });
  }
  private categoryNotFound(): never {
    throw new NotFoundException({
      code: 'EXPENSE_CATEGORY_NOT_FOUND',
      message: 'Expense category was not found.',
    });
  }
  private json(v: unknown): Prisma.InputJsonObject {
    return JSON.parse(JSON.stringify(v)) as Prisma.InputJsonObject;
  }
}
