import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { AccountType } from '../../../generated/prisma/enums.js';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto.js';

export class ListAccountsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @IsOptional()
  @IsEnum(AccountType)
  type?: AccountType;

  @IsOptional()
  @IsIn(['true', 'false'])
  isActive?: 'true' | 'false';
}
