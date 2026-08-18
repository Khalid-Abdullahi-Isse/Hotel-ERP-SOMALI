import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { RoomStatus } from '../../generated/prisma/enums.js';

export class ListRoomsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 25, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  search?: string;

  @IsOptional()
  @IsUUID('4')
  floorId?: string;

  @IsOptional()
  @IsUUID('4')
  roomTypeId?: string;

  @IsOptional()
  @IsEnum(RoomStatus)
  status?: RoomStatus;

  @ApiPropertyOptional({ enum: ['true', 'false'] })
  @IsOptional()
  @IsIn(['true', 'false'])
  isActive?: 'true' | 'false';
}
