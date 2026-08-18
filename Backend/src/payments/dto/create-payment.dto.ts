import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty() @IsUUID('4') reservationId!: string;
  @ApiProperty() @IsUUID('4') paymentMethodId!: string;
  @ApiProperty({ description: 'Unique UUID generated once by the client for safe retries' })
  @IsUUID('4')
  requestKey!: string;
  @ApiProperty({ example: '100.00' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'number' ? value.toString() : typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Matches(/^(?!0+(\.0{1,2})?$)\d{1,12}(\.\d{1,2})?$/)
  amount!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) reference?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) note?: string;
}
