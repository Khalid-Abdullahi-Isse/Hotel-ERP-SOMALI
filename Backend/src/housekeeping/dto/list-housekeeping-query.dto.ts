import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { HousekeepingStatus } from '../../generated/prisma/enums.js';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto.js';

export class ListHousekeepingQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional() @IsString() @MaxLength(160) search?: string;
  @ApiPropertyOptional({ enum: HousekeepingStatus })
  @IsOptional() @IsEnum(HousekeepingStatus) status?: HousekeepingStatus;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional() @IsUUID('4') roomId?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional() @IsUUID('4') assignedToId?: string;
}
