import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { MaintenancePriority } from '../../generated/prisma/enums.js';
export class CreateMaintenanceDto {
  @ApiProperty() @IsUUID('4') roomId!: string;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(2000) problem!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID('4') assignedToId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) category?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(MaintenancePriority)
  priority?: MaintenancePriority;
}
export class UpdateMaintenanceDto extends PartialType(CreateMaintenanceDto) {}
export class AssignMaintenanceDto {
  @ApiProperty() @IsUUID('4') assignedToId!: string;
}
export class HoldMaintenanceDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
export class CloseMaintenanceDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
export class CancelMaintenanceDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(500) reason!: string;
}
export class CompleteMaintenanceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'number' ? value.toString() : typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Matches(/^\d{1,12}(\.\d{1,2})?$/)
  cost?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
