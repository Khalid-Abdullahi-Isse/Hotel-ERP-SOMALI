import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto.js';

export class AccountingReportQueryDto {
  @IsDateString({ strict: true })
  dateFrom!: string;

  @IsDateString({ strict: true })
  dateTo!: string;
}

export class GeneralLedgerQueryDto extends PaginationQueryDto {
  @IsDateString({ strict: true })
  dateFrom!: string;

  @IsDateString({ strict: true })
  dateTo!: string;

  @IsOptional()
  @IsUUID('4')
  accountId?: string;

  @IsOptional()
  @IsUUID('4')
  journalId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sourceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;
}
