import { Type } from 'class-transformer';
import { ApiProperty, OmitType } from '@nestjs/swagger';
import { ValidateNested } from 'class-validator';
import { CreateGuestDto } from '../../guests/dto/create-guest.dto.js';
import { CreateReservationDto } from './create-reservation.dto.js';

export class CreateReservationWithGuestDto extends OmitType(CreateReservationDto, [
  'guestId',
] as const) {
  @ApiProperty({ type: CreateGuestDto })
  @ValidateNested()
  @Type(() => CreateGuestDto)
  guest!: CreateGuestDto;
}
