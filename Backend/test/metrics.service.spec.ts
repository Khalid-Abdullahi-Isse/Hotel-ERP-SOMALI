import { MetricsService } from '../src/health/metrics.service.js';

describe('MetricsService', () => {
  it('aggregates bounded route metrics without request identifiers', () => {
    const metrics = new MetricsService();
    metrics.observe('GET', '/api/v1/rooms/:id', 200, 10);
    metrics.observe('GET', '/api/v1/rooms/:id', 503, 30);

    const snapshot = metrics.snapshot() as {
      routes: Array<Record<string, unknown>>;
    };
    expect(snapshot.routes).toEqual([
      {
        route: 'GET /api/v1/rooms/:id',
        requests: 2,
        serverErrors: 1,
        averageDurationMs: 20,
        maxDurationMs: 30,
      },
    ]);
  });
});
