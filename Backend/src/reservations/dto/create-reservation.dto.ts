import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateReservationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  guestId!: string;

  @ApiProperty({ example: '2026-08-20' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  checkInDate!: string;

  @ApiProperty({ example: '2026-08-25' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  checkOutDate!: string;

  @IsInt()
  @Min(1)
  @Max(100)
  adults!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  children = 0;

  @ApiProperty({ type: [String], minItems: 1, maxItems: 10 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  roomIds!: string[];

  @ApiPropertyOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
