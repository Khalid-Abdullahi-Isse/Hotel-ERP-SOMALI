import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class UpdateHotelDto {
  @ApiPropertyOptional({ example: 'MOG-HOTEL' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  @Matches(/^[A-Z0-9][A-Z0-9_-]*$/)
  code?: string;

  @ApiPropertyOptional({ example: 'Mogadishu City Hotel' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({ example: 'USD' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsOptional()
  @Matches(/^[A-Z]{3}$/)
  currencyCode?: string;

  @ApiPropertyOptional({ example: 'Africa/Mogadishu' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^(UTC|[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+)$/)
  timezone?: string;
}
