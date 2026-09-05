import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
export class ApproveExpenseDto {
  @ApiProperty({ description: 'Optional approval note' })
  @IsString()
  @MaxLength(500)
  note?: string;
}
