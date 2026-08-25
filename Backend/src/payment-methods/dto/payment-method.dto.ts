import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class PaymentMethodDto {
  @ApiProperty({ example: 'EVC Plus' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @ApiProperty({ required: false, description: 'Asset account used for this payment method.' })
  @IsOptional()
  @IsUUID()
  ledgerAccountId?: string;
}
