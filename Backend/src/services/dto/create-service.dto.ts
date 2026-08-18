import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateServiceDto {
  @ApiProperty({ example: 'Airport transfer' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'One-way transfer from the airport' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ example: '25.00', description: 'Configured price used for every new charge' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'number' ? value.toString() : typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Matches(/^\d{1,12}(\.\d{1,2})?$/)
  defaultPrice!: string;
}
