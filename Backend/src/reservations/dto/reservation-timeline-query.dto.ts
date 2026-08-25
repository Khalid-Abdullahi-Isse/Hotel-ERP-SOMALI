import { Matches } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto.js';

export class ReservationTimelineQueryDto extends PaginationQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate!: string;
}
