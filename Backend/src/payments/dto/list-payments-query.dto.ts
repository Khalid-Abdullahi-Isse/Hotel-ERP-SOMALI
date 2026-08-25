import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaymentKind, PaymentStatus } from '../../generated/prisma/enums.js';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto.js';

export class ListPaymentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional() @IsString() @MaxLength(160) search?: string;
  @ApiPropertyOptional({ enum: PaymentKind })
  @IsOptional() @IsEnum(PaymentKind) kind?: PaymentKind;
  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional() @IsEnum(PaymentStatus) status?: PaymentStatus;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional() @IsUUID('4') paymentMethodId?: string;
}

