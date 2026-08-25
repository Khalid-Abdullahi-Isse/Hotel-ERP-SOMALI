import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { MaintenanceStatus } from '../../generated/prisma/enums.js';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto.js';

export class ListMaintenanceQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional() @IsString() @MaxLength(160) search?: string;
  @ApiPropertyOptional({ enum: MaintenanceStatus })
  @IsOptional() @IsEnum(MaintenanceStatus) status?: MaintenanceStatus;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional() @IsUUID('4') roomId?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional() @IsUUID('4') assignedToId?: string;
}

