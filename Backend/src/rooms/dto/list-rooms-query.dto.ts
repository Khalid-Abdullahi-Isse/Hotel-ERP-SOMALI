import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { RoomStatus } from '../../generated/prisma/enums.js';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto.js';

export class ListRoomsQueryDto extends PaginationQueryDto {
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
