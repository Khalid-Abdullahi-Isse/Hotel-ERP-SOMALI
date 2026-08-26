import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class UpdateAccountingSettingsDto {
  @IsOptional() @IsUUID('4') defaultRoomRevenueAccountId?: string;
  @IsOptional() @IsUUID('4') defaultGuestReceivableAccountId?: string;
  @IsOptional() @IsUUID('4') defaultCashAccountId?: string;
  @IsOptional() @IsUUID('4') defaultBankAccountId?: string;
  @IsOptional() @IsUUID('4') defaultMobileMoneyAccountId?: string;
  @IsOptional() @IsUUID('4') defaultDepositAccountId?: string;
  @IsOptional() @IsUUID('4') defaultTaxPayableAccountId?: string;
  @IsOptional() @IsUUID('4') defaultServiceRevenueAccountId?: string;
  @IsOptional() @IsUUID('4') defaultDiscountAccountId?: string;
  @IsOptional() @IsUUID('4') defaultExpenseAccountId?: string;
  @IsOptional() @IsUUID('4') defaultAccountsPayableAccountId?: string;
  @IsOptional() @IsIn(['CONTRA_REVENUE', 'REDUCE_REVENUE']) discountPostingMode?: string;
}
