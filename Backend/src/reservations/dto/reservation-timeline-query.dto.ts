import { Matches } from 'class-validator';

export class ReservationTimelineQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate!: string;
}
