import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { AccountingJournalType } from '../../../generated/prisma/enums.js';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto.js';

export class ListJournalsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsEnum(AccountingJournalType)
  type?: AccountingJournalType;

  @IsOptional()
  @IsIn(['true', 'false'])
  isActive?: 'true' | 'false';
}
