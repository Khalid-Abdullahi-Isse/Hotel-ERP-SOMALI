import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../auth/auth.constants.js';
import type { RequestUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../common/decorators/permissions.decorator.js';
import { ApproveExpenseDto } from './dto/approve-expense.dto.js';
import { CreateExpenseDto } from './dto/create-expense.dto.js';
import { ExpenseCategoryDto } from './dto/expense-category.dto.js';
import { ListExpensesQueryDto } from './dto/list-expenses-query.dto.js';
import { PayExpenseDto } from './dto/pay-expense.dto.js';
import { RejectExpenseDto } from './dto/reject-expense.dto.js';
import { ReverseExpenseDto } from './dto/reverse-expense.dto.js';
import { ExpensesService } from './expenses.service.js';
@ApiTags('expenses')
@ApiBearerAuth()
@Controller()
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}
  @Get('expense-categories') @RequirePermissions(PERMISSIONS.EXPENSE_VIEW) categories(
    @CurrentUser() actor: RequestUser,
  ) {
    return this.expenses.categories(actor);
  }
  @Post('expense-categories')
  @RequirePermissions(PERMISSIONS.EXPENSE_CATEGORY_MANAGE)
  createCategory(@Body() dto: ExpenseCategoryDto, @CurrentUser() actor: RequestUser) {
    return this.expenses.category(undefined, dto, undefined, actor);
  }
  @Patch('expense-categories/:id')
  @RequirePermissions(PERMISSIONS.EXPENSE_CATEGORY_MANAGE)
  updateCategory(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ExpenseCategoryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.expenses.category(id, dto, undefined, actor);
  }
  @Delete('expense-categories/:id')
  @RequirePermissions(PERMISSIONS.EXPENSE_CATEGORY_MANAGE)
  deactivateCategory(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.expenses.category(id, undefined, false, actor);
  }
  @Patch('expense-categories/:id/restore')
  @RequirePermissions(PERMISSIONS.EXPENSE_CATEGORY_MANAGE)
  restoreCategory(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.expenses.category(id, undefined, true, actor);
  }
  @Get('expenses') @RequirePermissions(PERMISSIONS.EXPENSE_VIEW) list(
    @Query() query: ListExpensesQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.expenses.list(query, actor);
  }
  @Post('expenses') @RequirePermissions(PERMISSIONS.EXPENSE_CREATE) create(
    @Body() dto: CreateExpenseDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.expenses.create(dto, actor);
  }
  @Post('expenses/post') @RequirePermissions(PERMISSIONS.EXPENSE_CREATE) createAndApprove(
    @Body() dto: CreateExpenseDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.expenses.create(dto, actor, { autoPost: true });
  }
  @Get('expenses/:id') @RequirePermissions(PERMISSIONS.EXPENSE_VIEW) find(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.expenses.find(id, actor);
  }
  @Post('expenses/:id/submit') @RequirePermissions(PERMISSIONS.EXPENSE_CREATE) submit(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.expenses.submit(id, actor);
  }
  @Post('expenses/:id/approve') @RequirePermissions(PERMISSIONS.EXPENSE_APPROVE) approve(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ApproveExpenseDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.expenses.approve(id, actor);
  }
  @Post('expenses/:id/reject') @RequirePermissions(PERMISSIONS.EXPENSE_REJECT) reject(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: RejectExpenseDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.expenses.reject(id, dto.reason, actor);
  }
  @Post('expenses/:id/pay') @RequirePermissions(PERMISSIONS.EXPENSE_PAY) pay(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: PayExpenseDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.expenses.pay(id, dto, actor);
  }
  @Post('expenses/:id/reverse') @RequirePermissions(PERMISSIONS.EXPENSE_REVERSE) reverse(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ReverseExpenseDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.expenses.reverse(id, dto.reason, actor);
  }
}
