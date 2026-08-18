import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
export class RefundPaymentDto {
  @ApiProperty() @IsUUID('4') requestKey!: string;
  @ApiProperty({ example: '25.00' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'number' ? value.toString() : typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Matches(/^(?!0+(\.0{1,2})?$)\d{1,12}(\.\d{1,2})?$/)
  amount!: string;
  @ApiProperty({ example: 'Duplicate collection' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) reference?: string;
}
