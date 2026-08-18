import { Injectable } from '@nestjs/common';

interface RouteMetric {
  count: number;
  errors: number;
  totalDurationMs: number;
  maxDurationMs: number;
}

@Injectable()
export class MetricsService {
  private readonly startedAt = new Date();
  private readonly routes = new Map<string, RouteMetric>();

  observe(method: string, route: string, statusCode: number, durationMs: number): void {
    const key = `${method} ${route}`;
    const metric = this.routes.get(key) ?? {
      count: 0,
      errors: 0,
      totalDurationMs: 0,
      maxDurationMs: 0,
    };
    metric.count += 1;
    if (statusCode >= 500) metric.errors += 1;
    metric.totalDurationMs += durationMs;
    metric.maxDurationMs = Math.max(metric.maxDurationMs, durationMs);
    this.routes.set(key, metric);
  }

  snapshot(): Record<string, unknown> {
    const memory = process.memoryUsage();
    return {
      startedAt: this.startedAt.toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      process: {
        residentMemoryBytes: memory.rss,
        heapUsedBytes: memory.heapUsed,
        heapTotalBytes: memory.heapTotal,
      },
      routes: [...this.routes.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([route, metric]) => ({
          route,
          requests: metric.count,
          serverErrors: metric.errors,
          averageDurationMs: Number((metric.totalDurationMs / metric.count).toFixed(2)),
          maxDurationMs: Number(metric.maxDurationMs.toFixed(2)),
        })),
    };
  }
}
