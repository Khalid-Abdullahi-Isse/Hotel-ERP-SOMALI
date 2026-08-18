import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { RoomStatus } from '../../generated/prisma/enums.js';

export class UpdateRoomStatusDto {
  @ApiProperty({ enum: [RoomStatus.AVAILABLE, RoomStatus.MAINTENANCE] })
  @IsIn([RoomStatus.AVAILABLE, RoomStatus.MAINTENANCE])
  status!: RoomStatus;
}
