import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { UserStatus } from '../../generated/prisma/enums.js';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto.js';

export class ListUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional() @IsString() @MaxLength(160) search?: string;
  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional() @IsEnum(UserStatus) status?: UserStatus;
}
