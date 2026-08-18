import { validateEnvironment } from '../src/config/configuration.js';

const validEnvironment = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://user:password@localhost:5432/hotel',
  CORS_ORIGINS: 'http://localhost:3000',
  JWT_ACCESS_SECRET: 'a-secure-test-secret-that-is-longer-than-32-characters',
};

describe('environment validation', () => {
  it('accepts seven-day refresh sessions and 15-minute access tokens by default', () => {
    const result = validateEnvironment(validEnvironment);
    expect(result.ACCESS_TOKEN_TTL_SECONDS).toBe(900);
    expect(result.REFRESH_TOKEN_TTL_DAYS).toBe(7);
  });

  it('rejects short JWT secrets', () => {
    expect(() => validateEnvironment({ ...validEnvironment, JWT_ACCESS_SECRET: 'short' })).toThrow(
      'JWT_ACCESS_SECRET',
    );
  });

  it('requires secure production-only settings', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
        AUTH_COOKIE_SECURE: 'false',
        SWAGGER_ENABLED: 'true',
      }),
    ).toThrow('AUTH_COOKIE_SECURE');
  });

  it('accepts a hardened production configuration', () => {
    const result = validateEnvironment({
      ...validEnvironment,
      NODE_ENV: 'production',
      AUTH_COOKIE_SECURE: 'true',
      SWAGGER_ENABLED: 'false',
      MONITORING_TOKEN: 'monitoring-token-that-is-at-least-32-characters',
    });
    expect(result.REQUEST_TIMEOUT_MS).toBe(30_000);
    expect(result.BODY_LIMIT_BYTES).toBe(1_048_576);
  });
});
