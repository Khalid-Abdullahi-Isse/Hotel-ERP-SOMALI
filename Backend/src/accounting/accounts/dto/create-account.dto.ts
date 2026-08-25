import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AccountType, NormalBalance } from '../../../generated/prisma/enums.js';

export class CreateAccountDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  @Matches(/^[A-Z0-9][A-Z0-9._-]*$/)
  code!: string;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @IsEnum(AccountType)
  type!: AccountType;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  subType?: string;

  @IsEnum(NormalBalance)
  normalBalance!: NormalBalance;

  @IsOptional()
  @IsUUID('4')
  parentAccountId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  allowManualPosting?: boolean;
}
