import 'dotenv/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/bootstrap/configure-application.js';

const monitoringToken = 'test-monitoring-token-with-more-than-32-characters';

describe('Production hardening', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    process.env.MONITORING_TOKEN = monitoringToken;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureApplication(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    delete process.env.MONITORING_TOKEN;
  });

  it('preserves a safe client request ID and replaces an unsafe value', async () => {
    const preserved = await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .set('X-Request-Id', 'frontdesk-12345');
    const replaced = await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .set('X-Request-Id', '<script>unsafe</script>');

    expect(preserved.status).toBe(200);
    expect(preserved.headers['x-request-id']).toBe('frontdesk-12345');
    expect(replaced.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('protects metrics and includes the request ID in errors', async () => {
    const denied = await request(app.getHttpServer())
      .get('/api/v1/health/metrics')
      .set('X-Request-Id', 'monitor-request-1');
    expect(denied.status).toBe(401);
    expect(denied.body.requestId).toBe('monitor-request-1');

    const allowed = await request(app.getHttpServer())
      .get('/api/v1/health/metrics')
      .set('X-Monitoring-Token', monitoringToken);
    expect(allowed.status).toBe(200);
    expect(allowed.body.routes).toEqual(expect.any(Array));
    expect(allowed.body.process.heapUsedBytes).toEqual(expect.any(Number));
  });

  it('rejects oversized and malformed JSON with safe errors', async () => {
    const oversized = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .set('Origin', 'http://localhost:3000')
      .set('X-Request-Id', 'oversized-request-1')
      .send({ identifier: 'admin', password: 'x'.repeat(1_050_000) });
    expect(oversized.status).toBe(413);
    expect(oversized.body.code).toBe('PAYLOAD_TOO_LARGE');
    expect(oversized.body.requestId).toBe('oversized-request-1');

    const malformed = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .set('Origin', 'http://localhost:3000')
      .send('{');
    expect(malformed.status).toBe(400);
    expect(malformed.body.code).toBe('BAD_REQUEST');
  });
});
