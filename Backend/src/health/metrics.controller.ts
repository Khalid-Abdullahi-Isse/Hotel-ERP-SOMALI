import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { timingSafeEqual } from 'node:crypto';
import { Public } from '../common/decorators/public.decorator.js';
import { MetricsService } from './metrics.service.js';

@ApiTags('health')
@Public()
@Controller('health')
export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly config: ConfigService,
  ) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Authenticated operational process and route metrics' })
  @ApiHeader({ name: 'X-Monitoring-Token', required: true })
  @ApiResponse({ status: 200, description: 'Current process metrics' })
  metricsSnapshot(@Headers('x-monitoring-token') supplied?: string): Record<string, unknown> {
    const expected = this.config.getOrThrow<string>('MONITORING_TOKEN');
    if (!this.matches(supplied, expected)) {
      throw new UnauthorizedException({
        code: 'INVALID_MONITORING_TOKEN',
        message: 'A valid monitoring token is required.',
      });
    }
    return this.metrics.snapshot();
  }

  private matches(supplied: string | undefined, expected: string): boolean {
    if (!supplied || !expected) return false;
    const suppliedBuffer = Buffer.from(supplied);
    const expectedBuffer = Buffer.from(expected);
    return (
      suppliedBuffer.length === expectedBuffer.length &&
      timingSafeEqual(suppliedBuffer, expectedBuffer)
    );
  }
}
