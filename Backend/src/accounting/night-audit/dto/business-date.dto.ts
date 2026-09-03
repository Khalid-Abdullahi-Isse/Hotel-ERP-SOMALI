import { IsDateString } from 'class-validator';

export class BusinessDateDto {
  @IsDateString({ strict: true })
  businessDate!: string;
}