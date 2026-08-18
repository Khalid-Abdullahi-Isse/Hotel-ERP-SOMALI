import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';
export class ReportQueryDto {
  @ApiProperty() @IsDateString({ strict: true }) from!: string;
  @ApiProperty() @IsDateString({ strict: true }) to!: string;
}
