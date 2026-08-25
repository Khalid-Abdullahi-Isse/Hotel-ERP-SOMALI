import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AccountingJournalType } from '../../../generated/prisma/enums.js';

export class CreateJournalDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(24)
  @Matches(/^[A-Z0-9][A-Z0-9_-]*$/)
  code!: string;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsEnum(AccountingJournalType)
  type!: AccountingJournalType;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
