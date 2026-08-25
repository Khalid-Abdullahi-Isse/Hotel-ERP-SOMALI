import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto.js';

export class ListExpensesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional() @IsString() @MaxLength(160) search?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional() @IsUUID('4') categoryId?: string;
  @ApiPropertyOptional({ enum: ['true', 'false'] })
  @IsOptional() @IsIn(['true', 'false']) reversed?: 'true' | 'false';
}

