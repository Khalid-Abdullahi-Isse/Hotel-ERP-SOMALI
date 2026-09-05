
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class CreateExpenseDto {
  @ApiProperty()
  @IsUUID('4')
  categoryId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  paymentMethodId?: string;

  @ApiProperty()
  @IsUUID('4')
  requestKey!: string;

  @ApiProperty({ example: '50.00' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'number'
      ? value.toString()
      : typeof value === 'string'
        ? value.trim()
        : value,
  )
  @IsString()
  @Matches(/^(?!0+(\.0{1,2})?$)\d{1,12}(\.\d{1,2})?$/)
  amount!: string;

  @ApiProperty({ example: '2026-08-17' })
  @IsDateString({ strict: true })
  expenseDate!: string;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @ApiPropertyOptional({ example: '2026-09-15' })
  @IsOptional()
  @IsDateString({ strict: true })
  dueDate?: string;
}