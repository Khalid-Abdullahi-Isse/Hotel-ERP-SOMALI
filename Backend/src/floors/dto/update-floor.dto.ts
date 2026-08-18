import { PartialType } from '@nestjs/swagger';
import { CreateFloorDto } from './create-floor.dto.js';

export class UpdateFloorDto extends PartialType(CreateFloorDto) {}
