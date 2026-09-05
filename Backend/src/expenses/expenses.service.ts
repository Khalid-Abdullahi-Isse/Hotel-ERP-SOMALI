import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { ExpenseStatus } from '../generated/prisma/enums.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { PERMISSIONS } from '../auth/auth.constants.js';
import type { RequestUser } from '../auth/auth.types.js';
import { runSerializable } from '../common/database/serializable-transaction.js';
import { paginatedResponse, paginationOffset } from '../common/pagination/pagination.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateExpenseDto } from './dto/create-expense.dto.js';
import type { ExpenseCategoryDto } from './dto/expense-category.dto.js';
import type { ListExpensesQueryDto } from './dto/list-expenses-query.dto.js';
import type { PayExpenseDto } from './dto/pay-expense.dto.js';
import { AccountType } from '../generated/prisma/enums.js';
import { ExpenseAccountingService } from '../accounting/expense-accounting.service.js';
const INCLUDE = {
  hotel: { select: { currencyCode: true } },
  category: { select: { id: true, name: true, expenseAccountId: true } },
  paymentMethod: { select: { id: true, name: true, ledgerAccountId: true } },
  createdBy: { select: { id: true, fullName: true } },
  approvedBy: { select: { id: true, fullName: true } },
  paidBy: { select: { id: true, fullName: true } },
  rejectedBy: { select: { id: true, fullName: true } },
  reversedBy: { select: { id: true, fullName: true } },
} as const;
@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audits: AuditLogsService,
    private readonly expenseAccounting: ExpenseAccountingService,
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
      if (dto?.expenseAccountId) {
        const account = await tx.account.findFirst({
          where: {
            id: dto.expenseAccountId,
            hotelId: actor.hotelId,
            type: AccountType.EXPENSE,
            isActive: true,
          },
          select: { id: true },
        });
        if (!account) {
          throw new ConflictException({
            code: 'INVALID_EXPENSE_ACCOUNT',
            message: 'Expense category account must be an active same-hotel expense account.',
          });
        }
      }
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
  create(
    dto: CreateExpenseDto,
    actor: RequestUser,
    options: { autoPost?: boolean } = {},
  ) {
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
        if (options.autoPost && existing.status === ExpenseStatus.APPROVED) {
          await this.postAccounting(existing, tx, actor);
        }
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
      const createData: Prisma.ExpenseUncheckedCreateInput = {
        hotelId: actor.hotelId,
        categoryId: dto.categoryId,
        paymentMethodId: dto.paymentMethodId,
        createdById: actor.id,
        requestKey: dto.requestKey,
        amount: new Prisma.Decimal(dto.amount),
        expenseDate: new Date(`${dto.expenseDate}T00:00:00.000Z`),
        description: dto.description.trim(),
        reference: dto.reference?.trim(),
        invoiceNumber: dto.invoiceNumber?.trim(),
        dueDate: dto.dueDate ? new Date(`${dto.dueDate}T00:00:00.000Z`) : undefined,
        status: ExpenseStatus.SUBMITTED,
        submittedAt: new Date(),
      };
      if (options.autoPost) {
        createData.status = ExpenseStatus.APPROVED;
        createData.approvedAt = new Date();
        createData.approvedById = actor.id;
      }
      const expense = await tx.expense.create({ data: createData, include: INCLUDE });
      if (options.autoPost) {
        await this.postAccounting(expense, tx, actor);
      }
      await this.audits.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: options.autoPost ? 'expense.create_and_approve' : 'expense.create',
          entityType: 'Expense',
          entityId: expense.id,
          newValue: this.json(this.view(expense)),
        },
        tx,
      );
      return { idempotentReplay: false, expense: this.view(expense) };
    });
  }

  submit(id: string, actor: RequestUser) {
    return runSerializable(this.prisma, async (tx) => {
      const before = await this.lockAndGet(tx, id, actor.hotelId);
      if (before.status === ExpenseStatus.SUBMITTED)
        return this.view(await this.reload(tx, id));
      if (before.status !== ExpenseStatus.DRAFT)
        throw this.transitionError('A draft expense can be submitted for approval.');
      const value = await tx.expense.update({
        where: { id },
        data: { status: ExpenseStatus.SUBMITTED, submittedAt: new Date() },
        include: INCLUDE,
      });
      await this.audit(tx, actor, 'expense.submit', id, { status: before.status }, { status: value.status });
      return this.view(value);
    });
  }

  approve(id: string, actor: RequestUser) {
    return runSerializable(this.prisma, async (tx) => {
      const before = await this.lockAndGet(tx, id, actor.hotelId);
      if (before.status === ExpenseStatus.APPROVED)
        return this.view(await this.reload(tx, id));
      if (before.status !== ExpenseStatus.SUBMITTED && before.status !== ExpenseStatus.PENDING_APPROVAL)
        throw this.transitionError('Only a submitted expense can be approved.');
      if (before.createdById === actor.id)
        throw new ConflictException({
          code: 'EXPENSE_SELF_APPROVAL_FORBIDDEN',
          message: 'A user cannot approve their own expense.',
        });
      const value = await tx.expense.update({
        where: { id },
        data: {
          status: ExpenseStatus.APPROVED,
          approvedAt: new Date(),
          approvedById: actor.id,
          rejectedAt: null,
          rejectedById: null,
          rejectionReason: null,
        },
        include: INCLUDE,
      });
      await this.audit(
        tx,
        actor,
        'expense.approve',
        id,
        { status: before.status, createdById: before.createdById },
        { status: value.status, approvedById: value.approvedById },
      );
      return this.view(value);
    });
  }

  reject(id: string, reason: string, actor: RequestUser) {
    return runSerializable(this.prisma, async (tx) => {
      const before = await this.lockAndGet(tx, id, actor.hotelId);
      if (before.status === ExpenseStatus.REJECTED)
        return this.view(await this.reload(tx, id));
      if (before.status !== ExpenseStatus.SUBMITTED && before.status !== ExpenseStatus.PENDING_APPROVAL)
        throw this.transitionError('Only a submitted expense can be rejected.');
      const value = await tx.expense.update({
        where: { id },
        data: {
          status: ExpenseStatus.REJECTED,
          rejectedAt: new Date(),
          rejectedById: actor.id,
          rejectionReason: reason.trim(),
        },
        include: INCLUDE,
      });
      await this.audit(
        tx,
        actor,
        'expense.reject',
        id,
        { status: before.status },
        { status: value.status, reason: value.rejectionReason },
      );
      return this.view(value);
    });
  }

  pay(id: string, dto: PayExpenseDto, actor: RequestUser) {
    return runSerializable(this.prisma, async (tx) => {
      const before = await this.lockAndGet(tx, id, actor.hotelId);
      if (before.status === ExpenseStatus.PAID) {
        const existing = await this.reload(tx, id);
        await this.postAccounting(existing, tx, actor);
        return { idempotentReplay: true, expense: this.view(existing) };
      }
      if (before.status !== ExpenseStatus.APPROVED)
        throw this.transitionError('Only an approved expense can be paid.');
      const data: Prisma.ExpenseUncheckedUpdateInput = {
        status: ExpenseStatus.PAID,
        paidAt: new Date(),
        paidById: actor.id,
      };
      if (dto.paymentMethodId) {
        const method = await tx.paymentMethod.findFirst({
          where: { id: dto.paymentMethodId, hotelId: actor.hotelId, isActive: true },
        });
        if (!method)
          throw new ConflictException({
            code: 'PAYMENT_METHOD_NOT_AVAILABLE',
            message: 'Expense payment method is inactive or invalid.',
          });
        data.paymentMethodId = method.id;
      }
      if (dto.reference) data.reference = dto.reference.trim();
      const value = await tx.expense.update({ where: { id }, data, include: INCLUDE });
      await this.postAccounting(value, tx, actor);
      await this.audit(
        tx,
        actor,
        'expense.pay',
        id,
        { status: before.status },
        { status: value.status, paidById: actor.id, amount: value.amount.toString() },
      );
      return { idempotentReplay: false, expense: this.view(value) };
    });
  }
  async list(query: ListExpensesQueryDto, actor: RequestUser) {
    const search = query.search?.trim();
    const where: Prisma.ExpenseWhereInput = {
      hotelId: actor.hotelId,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.reversed === 'true'
        ? { reversedAt: { not: null } }
        : query.reversed === 'false'
          ? { reversedAt: null }
          : {}),
      ...(search
        ? {
            OR: [
              { reference: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { category: { name: { contains: search, mode: 'insensitive' } } },
              { createdBy: { fullName: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [values, total] = await this.prisma.$transaction([
      this.prisma.expense.findMany({
        where,
        include: INCLUDE,
        orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        skip: paginationOffset(query.page, query.limit),
        take: query.limit,
      }),
      this.prisma.expense.count({ where }),
    ]);
    return paginatedResponse(
      values.map((v) => this.view(v)),
      query.page,
      query.limit,
      total,
    );
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
      const before = await this.lockAndGet(tx, id, actor.hotelId);
      if (before.reversedAt)
        return this.view(await this.reload(tx, id));
      if (before.status !== ExpenseStatus.PAID && before.status !== ExpenseStatus.APPROVED)
        throw this.transitionError('Only an approved or paid expense can be reversed.');
      const value = await tx.expense.update({
        where: { id },
        data: { reversedAt: new Date(), reversedById: actor.id, reversalReason: reason.trim() },
        include: INCLUDE,
      });
      await this.expenseAccounting.reverseExpense(id, reason, actor, tx);
      await this.audits.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'expense.reverse',
          entityType: 'Expense',
          entityId: id,
          oldValue: { status: before.status, reversedAt: null },
          newValue: { reversedAt: value.reversedAt?.toISOString(), reason: value.reversalReason },
        },
        tx,
      );
      return this.view(value);
    });
  }
  private async postAccounting(
    expense: Prisma.ExpenseGetPayload<{ include: typeof INCLUDE }>,
    tx: Prisma.TransactionClient,
    actor: RequestUser,
  ) {
    await this.expenseAccounting.postExpense(this.accountingEvent(expense), actor, tx);
  }
  private async lockAndGet(
    tx: Prisma.TransactionClient,
    id: string,
    hotelId: string,
  ) {
    const rows = await tx.$queryRaw<
      Array<{ id: string }>
    >`SELECT "id" FROM "Expense" WHERE "id"=${id}::uuid AND "hotelId"=${hotelId}::uuid FOR UPDATE`;
    if (rows.length !== 1) this.notFound();
    return tx.expense.findUniqueOrThrow({ where: { id } });
  }
  private reload(tx: Prisma.TransactionClient, id: string) {
    return tx.expense.findUniqueOrThrow({ where: { id }, include: INCLUDE });
  }
  private async audit(
    tx: Prisma.TransactionClient,
    actor: RequestUser,
    action: string,
    id: string,
    oldValue: object,
    newValue: object,
  ) {
    await this.audits.record(
      {
        hotelId: actor.hotelId,
        userId: actor.id,
        action,
        entityType: 'Expense',
        entityId: id,
        oldValue: this.json(oldValue),
        newValue: this.json(newValue),
      },
      tx,
    );
  }
  private transitionError(message: string): ConflictException {
    return new ConflictException({
      code: 'INVALID_EXPENSE_TRANSITION',
      message,
    });
  }
  private view<T extends { amount: Prisma.Decimal; expenseDate: Date }>(v: T & { dueDate?: Date | null }) {
    return {
      ...v,
      amount: v.amount.toString(),
      expenseDate: v.expenseDate.toISOString().slice(0, 10),
      dueDate: v.dueDate ? v.dueDate.toISOString().slice(0, 10) : null,
      reversed: 'reversedAt' in v && Boolean(v.reversedAt),
    };
  }
  private accountingEvent(expense: Prisma.ExpenseGetPayload<{ include: typeof INCLUDE }>) {
    return {
      id: expense.id,
      amount: expense.amount,
      expenseDate: expense.expenseDate,
      description: expense.description,
      reference: expense.reference,
      expenseAccountId: expense.category.expenseAccountId,
      paymentAccountId: expense.paymentMethod?.ledgerAccountId,
      hasPaymentMethod: expense.paymentMethodId !== null,
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
