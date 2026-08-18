import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateFloorDto {
  @ApiProperty({
    example: 1,
    description: 'Use 0 for ground floor and negative values for basements',
  })
  @IsInt()
  @Min(-20)
  @Max(300)
  number!: number;

  @ApiPropertyOptional({ example: 'First Floor' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;
}
