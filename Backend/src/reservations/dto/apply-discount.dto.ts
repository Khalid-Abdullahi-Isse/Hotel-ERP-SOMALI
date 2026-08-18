import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

export class ApplyDiscountDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'number' ? value.toString() : typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Matches(/^\d{1,12}(\.\d{1,2})?$/)
  amount!: string;
}
