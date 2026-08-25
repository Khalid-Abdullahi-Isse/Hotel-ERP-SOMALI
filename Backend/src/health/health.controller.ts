import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Cache } from 'cache-manager';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { Public } from '../common/decorators/public.decorator.js';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  @Get('live')
  @ApiOperation({ summary: 'Process liveness probe' })
  @ApiResponse({ status: 200, description: 'Process is running' })
  live(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Database and Redis readiness probe' })
  @ApiResponse({ status: 200, description: 'Application, database, and Redis are ready' })
  async ready(): Promise<{ status: string; database: string; redis: string; timestamp: string }> {
    const cacheKey = `health:${randomUUID()}`;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      await this.cache.set(cacheKey, 'ok', 5_000);
      const cached = await this.cache.get(cacheKey);
      await this.cache.del(cacheKey);
      if (cached !== 'ok') throw new Error('Redis cache probe returned an unexpected value');
      return {
        status: 'ok',
        database: 'up',
        redis: 'up',
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'A required application dependency is not ready.',
      });
    }
  }
}
