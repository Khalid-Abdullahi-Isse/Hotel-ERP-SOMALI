import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@example.com', description: 'Email address or username' })
  @IsString()
  @MinLength(3)
  @MaxLength(254)
  identifier!: string;

  @ApiProperty({ format: 'password', minLength: 12 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}
