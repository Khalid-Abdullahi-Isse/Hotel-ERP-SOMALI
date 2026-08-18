import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';

export class SearchAvailabilityQueryDto {
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
