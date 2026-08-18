import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class ReplaceReservationRoomsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  roomIds!: string[];
}
