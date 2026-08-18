import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../auth/auth.constants.js';
import type { RequestUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../common/decorators/permissions.decorator.js';
import { CreateFloorDto } from './dto/create-floor.dto.js';
import { UpdateFloorDto } from './dto/update-floor.dto.js';
import { FloorsService } from './floors.service.js';

@ApiTags('floors')
@ApiBearerAuth()
@RequirePermissions(PERMISSIONS.FLOOR_MANAGE)
@Controller('floors')
export class FloorsController {
  constructor(private readonly floors: FloorsService) {}

  @Post()
  create(@Body() dto: CreateFloorDto, @CurrentUser() actor: RequestUser) {
    return this.floors.create(dto, actor);
  }

  @Get()
  list(@CurrentUser() actor: RequestUser) {
    return this.floors.list(actor);
  }

  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.floors.findOne(id, actor);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateFloorDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.floors.update(id, dto, actor);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an empty floor' })
  remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.floors.remove(id, actor);
  }
}
