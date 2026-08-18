import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateRoomTypeDto {
  @ApiProperty({ example: 'STD' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  @Matches(/^[A-Z0-9][A-Z0-9_-]*$/)
  code!: string;

  @ApiProperty({ example: 'Standard' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  @Max(50)
  capacityAdults!: number;

  @ApiProperty({ example: 1, default: 0 })
  @IsInt()
  @Min(0)
  @Max(50)
  capacityChildren!: number;

  @ApiProperty({
    example: '100.00',
    description: 'Default nightly price for every room of this type',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'number' ? value.toString() : typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Matches(/^\d{1,12}(\.\d{1,2})?$/)
  basePrice!: string;
}
