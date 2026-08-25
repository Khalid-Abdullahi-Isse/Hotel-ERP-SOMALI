import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto.js';
export class ListAuditQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) entityType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(96) action?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID('4') userId?: string;
}
