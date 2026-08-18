import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';
import { Public } from '../common/decorators/public.decorator.js';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('live')
  @ApiOperation({ summary: 'Process liveness probe' })
  @ApiResponse({ status: 200, description: 'Process is running' })
  live(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Database readiness probe' })
  @ApiResponse({ status: 200, description: 'Application and database are ready' })
  async ready(): Promise<{ status: string; database: string; timestamp: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'up', timestamp: new Date().toISOString() };
    } catch {
      throw new ServiceUnavailableException({
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database is not ready.',
      });
    }
  }
}
