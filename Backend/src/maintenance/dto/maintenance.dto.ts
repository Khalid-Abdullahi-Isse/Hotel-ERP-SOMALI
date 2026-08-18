import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
export class CreateMaintenanceDto {
  @ApiProperty() @IsUUID('4') roomId!: string;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(2000) problem!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID('4') assignedToId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
export class UpdateMaintenanceDto extends PartialType(CreateMaintenanceDto) {}
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
