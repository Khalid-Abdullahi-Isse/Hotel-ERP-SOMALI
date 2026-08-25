import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { InvoiceStatus } from '../../generated/prisma/enums.js';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto.js';

export class ListInvoicesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional() @IsString() @MaxLength(160) search?: string;
  @ApiPropertyOptional({ enum: InvoiceStatus })
  @IsOptional() @IsEnum(InvoiceStatus) status?: InvoiceStatus;
}

