import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'NIGHT SUPERVISOR' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  @Matches(/^[A-Z][A-Z0-9 _-]*$/)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ type: [String], example: ['reservation.view', 'report.view'] })
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @Matches(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/, { each: true })
  permissionKeys!: string[];
}
