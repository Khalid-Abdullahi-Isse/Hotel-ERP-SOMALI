import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
export class ListAuditQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) entityType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(96) action?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID('4') userId?: string;
  @ApiPropertyOptional({ default: 1 }) @Type(() => Number) @IsInt() @Min(1) page = 1;
  @ApiPropertyOptional({ default: 50 }) @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;
}
