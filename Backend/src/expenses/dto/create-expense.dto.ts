import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
export class CreateExpenseDto {
  @ApiProperty() @IsUUID('4') categoryId!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID('4') paymentMethodId?: string;
  @ApiProperty() @IsUUID('4') requestKey!: string;
  @ApiProperty({ example: '50.00' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'number' ? value.toString() : typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Matches(/^(?!0+(\.0{1,2})?$)\d{1,12}(\.\d{1,2})?$/)
  amount!: string;
  @ApiProperty({ example: '2026-08-17' }) @IsDateString({ strict: true }) expenseDate!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(255) description!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) reference?: string;
}
