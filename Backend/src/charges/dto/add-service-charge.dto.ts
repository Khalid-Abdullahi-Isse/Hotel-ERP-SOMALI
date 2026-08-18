import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Matches } from 'class-validator';

export class AddServiceChargeDto {
  @ApiProperty()
  @IsUUID('4')
  serviceId!: string;

  @ApiProperty({ example: '1.00', default: '1.00' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'number' ? value.toString() : typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Matches(/^(?!0+(\.0{1,2})?$)\d{1,8}(\.\d{1,2})?$/)
  quantity!: string;
}
