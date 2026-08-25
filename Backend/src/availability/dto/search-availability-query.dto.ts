import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto.js';

export class SearchAvailabilityQueryDto extends PaginationQueryDto {
  @ApiProperty({ example: '2026-08-20' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  checkInDate!: string;

  @ApiProperty({ example: '2026-08-25' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  checkOutDate!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  roomTypeId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  floorId?: string;

  @ApiPropertyOptional({
    description: 'Return only rooms that are operationally ready for immediate check-in.',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  readyOnly?: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  adults = 1;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  children = 0;
}
