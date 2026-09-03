import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import type { RequestUser } from '../../auth/auth.types.js';
import { paginatedResponse, paginationOffset } from '../../common/pagination/pagination.util.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  AccountingReportQueryDto,
  BalanceSheetQueryDto,
  GeneralLedgerQueryDto,
} from './dto/accounting-report-query.dto.js';

type LedgerRow = {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  normalBalance: 'DEBIT' | 'CREDIT';
  businessDate: Date;
  entryId: string;
  entryNumber: string;
  reference: string | null;
  description: string;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
  sourceType: string;
  runningBalance: Prisma.Decimal;
};

@Injectable()
export class AccountingReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async generalLedger(query: GeneralLedgerQueryDto, actor: RequestUser) {
    this.validateDates(query.dateFrom, query.dateTo);
    const filters = this.ledgerFilters(query, actor.hotelId);
    const offset = paginationOffset(query.page, query.limit);
    const rows = await this.prisma.$queryRaw<LedgerRow[]>(Prisma.sql`
      WITH opening AS (
        SELECT jl."accountId", coalesce(sum(jl."debit" - jl."credit"), 0) amount
        FROM "JournalLine" jl
        JOIN "JournalEntry" je ON je.id=jl."journalEntryId"
        WHERE je."hotelId"=${actor.hotelId}::uuid
          AND je.status IN ('POSTED','REVERSED')
          AND je."businessDate" < ${query.dateFrom}::date
        GROUP BY jl."accountId"
      ), filtered AS (
        SELECT jl.id, jl."accountId", a.code "accountCode", a.name "accountName",
          a."normalBalance", je."businessDate", je.id "entryId", je."entryNumber",
          je.reference, coalesce(jl.description, je.description) description,
          jl.debit, jl.credit, je."sourceType", je."postingDate"
        FROM "JournalLine" jl
        JOIN "JournalEntry" je ON je.id=jl."journalEntryId"
        JOIN "Account" a ON a.id=jl."accountId"
        WHERE ${filters}
      ), calculated AS (
        SELECT f.*,
          CASE WHEN f."normalBalance"='DEBIT'
            THEN coalesce(o.amount,0) + sum(f.debit-f.credit) OVER (PARTITION BY f."accountId" ORDER BY f."businessDate",f."postingDate",f."entryNumber",f.id)
            ELSE -(coalesce(o.amount,0) + sum(f.debit-f.credit) OVER (PARTITION BY f."accountId" ORDER BY f."businessDate",f."postingDate",f."entryNumber",f.id))
          END "runningBalance"
        FROM filtered f LEFT JOIN opening o ON o."accountId"=f."accountId"
      )
      SELECT * FROM calculated ORDER BY "accountCode","businessDate","postingDate","entryNumber",id
      OFFSET ${offset} LIMIT ${query.limit}
    `);
    const countRows = await this.prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT count(*)::bigint count FROM "JournalLine" jl
      JOIN "JournalEntry" je ON je.id=jl."journalEntryId"
      JOIN "Account" a ON a.id=jl."accountId"
      WHERE ${filters}
    `);
    const hotel = await this.hotel(actor.hotelId);
    return {
      ...paginatedResponse(
        rows.map((row) => ({
          ...row,
          businessDate: row.businessDate.toISOString().slice(0, 10),
          debit: row.debit.toFixed(4),
          credit: row.credit.toFixed(4),
          runningBalance: row.runningBalance.toFixed(4),
        })),
        query.page,
        query.limit,
        Number(countRows[0]?.count ?? 0),
      ),
      report: this.metadata(query.dateFrom, query.dateTo, hotel),
    };
  }

  async trialBalance(query: AccountingReportQueryDto, actor: RequestUser) {
    this.validateDates(query.dateFrom, query.dateTo);

    const rows = await this.prisma.$queryRaw<
      Array<{
        accountId: string;
        accountCode: string;
        accountName: string;
        accountType: string;
        normalBalance: 'DEBIT' | 'CREDIT';
        openingNet: Prisma.Decimal;
        periodDebit: Prisma.Decimal;
        periodCredit: Prisma.Decimal;
        closingNet: Prisma.Decimal;
      }>
    >(Prisma.sql`
      SELECT a.id "accountId", a.code "accountCode", a.name "accountName",
        a.type::text "accountType", a."normalBalance",
        coalesce(sum(jl.debit - jl.credit) FILTER (WHERE je."businessDate" < ${query.dateFrom}::date), 0) "openingNet",
        coalesce(sum(jl.debit) FILTER (WHERE je."businessDate" >= ${query.dateFrom}::date AND je."businessDate" <= ${query.dateTo}::date), 0) "periodDebit",
        coalesce(sum(jl.credit) FILTER (WHERE je."businessDate" >= ${query.dateFrom}::date AND je."businessDate" <= ${query.dateTo}::date), 0) "periodCredit",
        coalesce(sum(jl.debit - jl.credit) FILTER (WHERE je."businessDate" <= ${query.dateTo}::date), 0) "closingNet"
      FROM "Account" a
      LEFT JOIN "JournalLine" jl ON jl."accountId" = a.id
      LEFT JOIN "JournalEntry" je ON je.id = jl."journalEntryId" AND je.status IN ('POSTED','REVERSED')
      WHERE a."hotelId" = ${actor.hotelId}::uuid
        AND NOT EXISTS (
          SELECT 1 FROM "Account" child WHERE child."parentAccountId" = a.id
        )
      GROUP BY a.id
      ORDER BY a.code
    `);

    const directionalRows = rows.map((row) => {
      const openingNet = this.toDecimal(row.openingNet);
      const closingNet = this.toDecimal(row.closingNet);
      const opening = this.netToDirection(openingNet, row.normalBalance);
      const closing = this.netToDirection(closingNet, row.normalBalance);
      return {
        accountId: row.accountId,
        accountCode: row.accountCode,
        accountName: row.accountName,
        accountType: row.accountType,
        normalBalance: row.normalBalance,
        openingDebit: opening.debit,
        openingCredit: opening.credit,
        periodDebit: this.toDecimal(row.periodDebit),
        periodCredit: this.toDecimal(row.periodCredit),
        closingDebit: closing.debit,
        closingCredit: closing.credit,
      };
    });

    const zero = new Prisma.Decimal(0);
    const totalOpeningDebit = directionalRows.reduce((s, r) => s.plus(r.openingDebit), zero);
    const totalOpeningCredit = directionalRows.reduce((s, r) => s.plus(r.openingCredit), zero);
    const totalPeriodDebit = directionalRows.reduce((s, r) => s.plus(r.periodDebit), zero);
    const totalPeriodCredit = directionalRows.reduce((s, r) => s.plus(r.periodCredit), zero);
    const totalClosingDebit = directionalRows.reduce((s, r) => s.plus(r.closingDebit), zero);
    const totalClosingCredit = directionalRows.reduce((s, r) => s.plus(r.closingCredit), zero);
    const difference = totalClosingDebit.minus(totalClosingCredit);
    const isBalanced = difference.eq(0);

    const hotel = await this.hotel(actor.hotelId);
    return {
      report: this.metadata(query.dateFrom, query.dateTo, hotel),
      data: directionalRows.map((row) => ({
        accountId: row.accountId,
        accountCode: row.accountCode,
        accountName: row.accountName,
        accountType: row.accountType,
        normalBalance: row.normalBalance,
        openingDebit: row.openingDebit.toFixed(2),
        openingCredit: row.openingCredit.toFixed(2),
        periodDebit: row.periodDebit.toFixed(2),
        periodCredit: row.periodCredit.toFixed(2),
        closingDebit: row.closingDebit.toFixed(2),
        closingCredit: row.closingCredit.toFixed(2),
      })),
      totals: {
        openingDebit: totalOpeningDebit.toFixed(2),
        openingCredit: totalOpeningCredit.toFixed(2),
        periodDebit: totalPeriodDebit.toFixed(2),
        periodCredit: totalPeriodCredit.toFixed(2),
        closingDebit: totalClosingDebit.toFixed(2),
        closingCredit: totalClosingCredit.toFixed(2),
        difference: difference.toFixed(2),
        balanced: isBalanced,
      },
      warning: isBalanced ? null : 'SERIOUS_ACCOUNTING_IMBALANCE',
    };
  }

  async profitLoss(query: AccountingReportQueryDto, actor: RequestUser) {
    this.validateDates(query.dateFrom, query.dateTo);
    const rows = await this.accountBalances(actor.hotelId, query.dateFrom, query.dateTo, [
      'REVENUE',
      'EXPENSE',
    ]);
    const revenue = rows
      .filter((row) => row.accountType === 'REVENUE')
      .map((row) => ({ ...row, balance: row.credit.minus(row.debit) }));
    const expenses = rows
      .filter((row) => row.accountType === 'EXPENSE')
      .map((row) => ({ ...row, balance: row.debit.minus(row.credit) }));
    const totalRevenue = revenue.reduce((sum, row) => sum.plus(row.balance), new Prisma.Decimal(0));
    const totalExpenses = expenses.reduce(
      (sum, row) => sum.plus(row.balance),
      new Prisma.Decimal(0),
    );
    const hotel = await this.hotel(actor.hotelId);
    return {
      report: this.metadata(query.dateFrom, query.dateTo, hotel),
      revenue: revenue.map((row) => this.balanceView(row)),
      expenses: expenses.map((row) => this.balanceView(row)),
      totals: {
        revenue: totalRevenue.toFixed(4),
        expenses: totalExpenses.toFixed(4),
        netProfitLoss: totalRevenue.minus(totalExpenses).toFixed(4),
      },
    };
  }

  async balanceSheet(query: BalanceSheetQueryDto, actor: RequestUser) {
    if (query.dateFrom) this.validateDates(query.dateFrom, query.dateTo);
    const rows = await this.accountBalances(
      actor.hotelId,
      null,
      query.dateTo,
      ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'],
    );
    const assets = rows
      .filter((row) => row.accountType === 'ASSET')
      .map((row) => ({ ...row, balance: row.debit.minus(row.credit) }));
    const liabilities = rows
      .filter((row) => row.accountType === 'LIABILITY')
      .map((row) => ({ ...row, balance: row.credit.minus(row.debit) }));
    const equity = rows
      .filter((row) => row.accountType === 'EQUITY')
      .map((row) => ({ ...row, balance: row.credit.minus(row.debit) }));
    const income = rows
      .filter((row) => row.accountType === 'REVENUE')
      .reduce((sum, row) => sum.plus(row.credit).minus(row.debit), new Prisma.Decimal(0));
    const expense = rows
      .filter((row) => row.accountType === 'EXPENSE')
      .reduce((sum, row) => sum.plus(row.debit).minus(row.credit), new Prisma.Decimal(0));
    const currentProfitLoss = income.minus(expense);
    const totalAssets = assets.reduce((sum, row) => sum.plus(row.balance), new Prisma.Decimal(0));
    const totalLiabilities = liabilities.reduce(
      (sum, row) => sum.plus(row.balance),
      new Prisma.Decimal(0),
    );
    const totalEquity = equity
      .reduce((sum, row) => sum.plus(row.balance), new Prisma.Decimal(0))
      .plus(currentProfitLoss);
    const difference = totalAssets.minus(totalLiabilities).minus(totalEquity);
    const hotel = await this.hotel(actor.hotelId);
    return {
      report: this.metadata(query.dateTo, query.dateTo, hotel),
      assets: assets.map((row) => this.balanceView(row)),
      liabilities: liabilities.map((row) => this.balanceView(row)),
      equity: equity.map((row) => this.balanceView(row)),
      totals: {
        assets: totalAssets.toFixed(4),
        liabilities: totalLiabilities.toFixed(4),
        equity: totalEquity.toFixed(4),
        currentProfitLoss: currentProfitLoss.toFixed(4),
        difference: difference.toFixed(4),
        balanced: difference.eq(0),
      },
      warning: difference.eq(0) ? null : 'SERIOUS_ACCOUNTING_EQUATION_IMBALANCE',
    };
  }

  async accountStatement(query: GeneralLedgerQueryDto, accountId: string, actor: RequestUser) {
    this.validateDates(query.dateFrom, query.dateTo);
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, hotelId: actor.hotelId },
      select: { id: true, code: true, name: true, type: true, normalBalance: true },
    });
    if (!account) {
      throw new NotFoundException({
        code: 'ACCOUNT_NOT_FOUND',
        message: 'Account was not found.',
      });
    }
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        postingDate: Date;
        businessDate: Date;
        entryId: string;
        entryNumber: string;
        reference: string | null;
        description: string;
        sourceType: string;
        debit: Prisma.Decimal;
        credit: Prisma.Decimal;
        runningBalance: Prisma.Decimal;
      }>
    >(Prisma.sql`
      WITH opening AS (
        SELECT coalesce(sum(jl."debit" - jl."credit"), 0) amount
        FROM "JournalLine" jl
        JOIN "JournalEntry" je ON je.id=jl."journalEntryId"
        WHERE jl."accountId"=${accountId}::uuid
          AND je."hotelId"=${actor.hotelId}::uuid
          AND je.status IN ('POSTED','REVERSED')
          AND je."businessDate" < ${query.dateFrom}::date
      )
      SELECT jl.id, je."postingDate", je."businessDate", je.id "entryId", je."entryNumber",
        je.reference, coalesce(jl.description, je.description) description,
        je."sourceType", jl.debit, jl.credit,
        CASE WHEN a."normalBalance"='DEBIT'
          THEN coalesce(o.amount,0) + sum(jl.debit-jl.credit) OVER (ORDER BY je."businessDate",je."postingDate",je."entryNumber",jl.id)
          ELSE -(coalesce(o.amount,0) + sum(jl.debit-jl.credit) OVER (ORDER BY je."businessDate",je."postingDate",je."entryNumber",jl.id))
        END "runningBalance"
      FROM "JournalLine" jl
      JOIN "JournalEntry" je ON je.id=jl."journalEntryId"
      JOIN "Account" a ON a.id=jl."accountId"
      CROSS JOIN opening o
      WHERE jl."accountId"=${accountId}::uuid
        AND je."hotelId"=${actor.hotelId}::uuid
        AND je.status IN ('POSTED','REVERSED')
        AND je."businessDate">=${query.dateFrom}::date
        AND je."businessDate"<=${query.dateTo}::date
      ORDER BY je."businessDate",je."postingDate",je."entryNumber",jl.id
    `);
    const closing = rows.length
      ? rows[rows.length - 1].runningBalance
      : await this.openingBalance(actor.hotelId, accountId, query.dateFrom);
    const totalDebit = rows.reduce((sum, row) => sum.plus(row.debit), new Prisma.Decimal(0));
    const totalCredit = rows.reduce((sum, row) => sum.plus(row.credit), new Prisma.Decimal(0));
    const hotel = await this.hotel(actor.hotelId);
    return {
      report: this.metadata(query.dateFrom, query.dateTo, hotel),
      account,
      transactions: rows.map((row) => ({
        id: row.id,
        entryId: row.entryId,
        entryNumber: row.entryNumber,
        postingDate: row.postingDate.toISOString(),
        businessDate: row.businessDate.toISOString().slice(0, 10),
        reference: row.reference,
        description: row.description,
        sourceType: row.sourceType,
        debit: row.debit.toFixed(4),
        credit: row.credit.toFixed(4),
        runningBalance: row.runningBalance.toFixed(4),
      })),
      totals: {
        debit: totalDebit.toFixed(4),
        credit: totalCredit.toFixed(4),
        closingBalance: closing.toFixed(4),
      },
    };
  }

  private async openingBalance(
    hotelId: string,
    accountId: string,
    dateFrom: string,
  ): Promise<Prisma.Decimal> {
    const rows = await this.prisma.$queryRaw<
      Array<{ amount: Prisma.Decimal }>
    >(Prisma.sql`
      SELECT CASE WHEN a."normalBalance"='DEBIT'
        THEN coalesce(sum(jl."debit" - jl."credit") FILTER(WHERE je."businessDate" < ${dateFrom}::date), 0)
        ELSE coalesce(sum(jl."credit" - jl."debit") FILTER(WHERE je."businessDate" < ${dateFrom}::date), 0)
      END "amount"
      FROM "Account" a
      LEFT JOIN "JournalLine" jl ON jl."accountId"=a.id
      LEFT JOIN "JournalEntry" je ON je.id=jl."journalEntryId" AND je.status IN ('POSTED','REVERSED')
      WHERE a.id=${accountId}::uuid AND a."hotelId"=${hotelId}::uuid
      GROUP BY a."normalBalance"
    `);
    return rows[0]?.amount ?? new Prisma.Decimal(0);
  }

  private ledgerFilters(query: GeneralLedgerQueryDto, hotelId: string) {
    const conditions = [
      Prisma.sql`je."hotelId"=${hotelId}::uuid`,
      Prisma.sql`je.status IN ('POSTED','REVERSED')`,
      Prisma.sql`je."businessDate">=${query.dateFrom}::date`,
      Prisma.sql`je."businessDate"<=${query.dateTo}::date`,
    ];
    if (query.accountId) conditions.push(Prisma.sql`jl."accountId"=${query.accountId}::uuid`);
    if (query.journalId) conditions.push(Prisma.sql`je."journalId"=${query.journalId}::uuid`);
    if (query.sourceType) conditions.push(Prisma.sql`je."sourceType"=${query.sourceType}`);
    if (query.search) {
      const search = `%${query.search.trim()}%`;
      conditions.push(
        Prisma.sql`(je."entryNumber" ILIKE ${search} OR je.reference ILIKE ${search} OR je.description ILIKE ${search} OR a.code ILIKE ${search} OR a.name ILIKE ${search})`,
      );
    }
    return Prisma.join(conditions, ' AND ');
  }

  private accountBalances(
    hotelId: string,
    dateFrom: string | null,
    dateTo: string,
    types: string[],
  ) {
    const dateFilter = dateFrom
      ? Prisma.sql`AND je."businessDate">=${dateFrom}::date AND je."businessDate"<=${dateTo}::date`
      : Prisma.sql`AND je."businessDate"<=${dateTo}::date`;
    return this.prisma.$queryRaw<
      Array<{
        accountId: string;
        accountCode: string;
        accountName: string;
        accountType: string;
        debit: Prisma.Decimal;
        credit: Prisma.Decimal;
      }>
    >(Prisma.sql`
      SELECT a.id "accountId",a.code "accountCode",a.name "accountName",a.type::text "accountType",
        coalesce(sum(jl.debit) FILTER(WHERE je.id IS NOT NULL),0) debit,
        coalesce(sum(jl.credit) FILTER(WHERE je.id IS NOT NULL),0) credit
      FROM "Account" a
      LEFT JOIN "JournalLine" jl ON jl."accountId"=a.id
      LEFT JOIN "JournalEntry" je ON je.id=jl."journalEntryId" AND je.status IN ('POSTED','REVERSED')
        AND je."businessDate"<=${dateTo}::date ${dateFilter}
      WHERE a."hotelId"=${hotelId}::uuid AND a.type::text IN (${Prisma.join(types)})
      GROUP BY a.id ORDER BY a.code
    `);
  }

  private balanceView(row: {
    accountId: string;
    accountCode: string;
    accountName: string;
    balance: Prisma.Decimal;
  }) {
    return {
      accountId: row.accountId,
      accountCode: row.accountCode,
      accountName: row.accountName,
      balance: row.balance.toFixed(4),
    };
  }

  private toDecimal(value: unknown): Prisma.Decimal {
    if (value instanceof Prisma.Decimal) return value;
    if (typeof value === 'bigint') return new Prisma.Decimal(value.toString());
    if (typeof value === 'number') return new Prisma.Decimal(value);
    if (typeof value === 'string') return new Prisma.Decimal(value);
    return new Prisma.Decimal(0);
  }

  private netToDirection(
    net: Prisma.Decimal,
    normalBalance: 'DEBIT' | 'CREDIT',
  ): { debit: Prisma.Decimal; credit: Prisma.Decimal } {
    const zero = new Prisma.Decimal(0);
    if (normalBalance === 'DEBIT') {
      return net.gte(zero)
        ? { debit: net, credit: zero }
        : { debit: zero, credit: net.abs() };
    }
    return net.lte(zero)
      ? { debit: zero, credit: net.abs() }
      : { debit: net, credit: zero };
  }

  private validateDates(from: string, to: string) {
    if (from > to) {
      throw new BadRequestException({
        code: 'INVALID_REPORT_PERIOD',
        message: 'dateFrom must be on or before dateTo.',
      });
    }
  }

  private hotel(hotelId: string) {
    return this.prisma.hotel.findUniqueOrThrow({
      where: { id: hotelId },
      select: { id: true, code: true, name: true, currencyCode: true, timezone: true },
    });
  }

  private metadata(
    dateFrom: string,
    dateTo: string,
    hotel: { id: string; code: string; name: string; currencyCode: string; timezone: string },
  ) {
    return {
      reportId: crypto.randomUUID(),
      generatedAt: new Date().toISOString(),
      dateFrom,
      dateTo,
      currency: hotel.currencyCode,
      timezone: hotel.timezone,
      status: 'FINAL',
      hotel: { id: hotel.id, code: hotel.code, name: hotel.name },
    };
  }
}
