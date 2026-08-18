import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateRoomDto {
  @ApiProperty({ example: '101' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  @Matches(/^[A-Z0-9][A-Z0-9._-]*$/)
  roomNumber!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  roomTypeId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID('4')
  floorId?: string | null;

  @ApiPropertyOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
