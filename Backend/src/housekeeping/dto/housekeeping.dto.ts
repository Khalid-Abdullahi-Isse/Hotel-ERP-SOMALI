import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
export class HousekeepingUpdateDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID('4') assignedToId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}
