import { Type, Transform } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

const MONEY_PATTERN = /^\d{1,15}(\.\d{1,4})?$/;

export class CreateJournalLineDto {
  @IsUUID('4')
  accountId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'number' ? value.toString() : value,
  )
  @IsString()
  @Matches(MONEY_PATTERN)
  debit!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'number' ? value.toString() : value,
  )
  @IsString()
  @Matches(MONEY_PATTERN)
  credit!: string;
}

export class CreateJournalEntryDto {
  @IsUUID('4')
  journalId!: string;

  @IsDateString({ strict: true })
  businessDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  description!: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => CreateJournalLineDto)
  lines!: CreateJournalLineDto[];
}
