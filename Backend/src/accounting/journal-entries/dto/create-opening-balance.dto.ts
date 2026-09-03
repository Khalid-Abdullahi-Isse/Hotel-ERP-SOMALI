import { IsUUID } from 'class-validator';
import { CreateJournalEntryDto } from './create-journal-entry.dto.js';

export class CreateOpeningBalanceDto extends CreateJournalEntryDto {
  @IsUUID('4')
  sourceId!: string;
}
