import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
export class PayExpenseDto {
  @ApiPropertyOptional({ description: 'Payment method used to settle this expense' })
  @IsOptional() @IsUUID('4') paymentMethodId?: string;
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional() @IsString() @MaxLength(120) reference?: string;
}
