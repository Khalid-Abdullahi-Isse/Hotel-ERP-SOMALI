import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ReservationStatus } from '../../generated/prisma/enums.js';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto.js';

export class ListReservationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @IsOptional()
  @IsUUID('4')
  guestId?: string;

  @IsOptional()
  @IsUUID('4')
  roomId?: string;

  @IsOptional()
  @Transform((params) => {
    const value: unknown = params.value;
    return Array.isArray(value) ? value.map((entry: unknown) => String(entry)) : String(value).split(',');
  })
  @IsArray()
  @ArrayMaxSize(30)
  @IsUUID('4', { each: true })
  roomIds?: string[];

  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  arrivalFrom?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  arrivalTo?: string;
}
