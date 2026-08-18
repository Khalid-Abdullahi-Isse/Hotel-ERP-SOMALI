import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

export class UpdateReservationDto {
  @IsOptional()
  @IsUUID('4')
  guestId?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  checkInDate?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  checkOutDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  adults?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  children?: number;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
