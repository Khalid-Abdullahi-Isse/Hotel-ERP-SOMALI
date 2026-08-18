import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const cleanText = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;

export class CreateGuestDto {
  @ApiProperty({ example: 'Amina Hassan' })
  @Transform(cleanText)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  fullName!: string;

  @ApiPropertyOptional({ example: '+252611234567' })
  @Transform(cleanText)
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @ApiPropertyOptional({ example: 'amina@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(64)
  passportNumber?: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(64)
  nationalId?: string;

  @Transform(cleanText)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  nationality?: string;

  @Transform(cleanText)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @Transform(cleanText)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ default: false, description: 'Audit an intentional weak duplicate' })
  @IsOptional()
  @IsBoolean()
  allowPossibleDuplicate = false;
}
