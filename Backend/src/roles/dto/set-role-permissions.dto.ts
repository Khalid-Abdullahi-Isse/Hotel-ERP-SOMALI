import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsString, Matches } from 'class-validator';

export class SetRolePermissionsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @Matches(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/, { each: true })
  permissionKeys!: string[];
}
