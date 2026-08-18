import { z } from 'zod';

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    API_PREFIX: z.string().trim().min(1).default('api'),
    DATABASE_URL: z.string().url().startsWith('postgresql://'),
    CORS_ORIGINS: z.string().min(1),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    SWAGGER_ENABLED: z.enum(['true', 'false']).default('true'),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_ISSUER: z.string().trim().min(1).default('somali-hotel-erp'),
    JWT_AUDIENCE: z.string().trim().min(1).default('somali-hotel-erp-web'),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(300).max(3600).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
    AUTH_COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
    AUTH_MAX_FAILED_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),
    AUTH_LOCK_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
    BODY_LIMIT_BYTES: z.coerce.number().int().min(16_384).max(10_485_760).default(1_048_576),
    REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(30_000),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(3).default(0),
    MONITORING_TOKEN: z.string().default(''),
    RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(20).max(10_000).default(100),
  })
  .superRefine((environment, context) => {
    if (environment.NODE_ENV !== 'production') return;
    if (environment.AUTH_COOKIE_SECURE !== 'true') {
      context.addIssue({
        code: 'custom',
        path: ['AUTH_COOKIE_SECURE'],
        message: 'must be true in production',
      });
    }
    if (environment.SWAGGER_ENABLED !== 'false') {
      context.addIssue({
        code: 'custom',
        path: ['SWAGGER_ENABLED'],
        message: 'must be false in production',
      });
    }
    if (environment.MONITORING_TOKEN.length < 32) {
      context.addIssue({
        code: 'custom',
        path: ['MONITORING_TOKEN'],
        message: 'must contain at least 32 characters in production',
      });
    }
  });

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(raw: Record<string, unknown>): Environment {
  const result = environmentSchema.safeParse(raw);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return result.data;
}

export function configuration(): Record<string, unknown> {
  return {
    NODE_ENV: process.env.NODE_ENV ?? 'development',
    PORT: Number(process.env.PORT ?? 3000),
    API_PREFIX: process.env.API_PREFIX ?? 'api',
    DATABASE_URL: process.env.DATABASE_URL,
    CORS_ORIGINS: (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
    SWAGGER_ENABLED: process.env.SWAGGER_ENABLED !== 'false',
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    JWT_ISSUER: process.env.JWT_ISSUER ?? 'somali-hotel-erp',
    JWT_AUDIENCE: process.env.JWT_AUDIENCE ?? 'somali-hotel-erp-web',
    ACCESS_TOKEN_TTL_SECONDS: Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 900),
    REFRESH_TOKEN_TTL_DAYS: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 7),
    AUTH_COOKIE_SECURE: process.env.AUTH_COOKIE_SECURE === 'true',
    AUTH_MAX_FAILED_ATTEMPTS: Number(process.env.AUTH_MAX_FAILED_ATTEMPTS ?? 5),
    AUTH_LOCK_MINUTES: Number(process.env.AUTH_LOCK_MINUTES ?? 15),
    BODY_LIMIT_BYTES: Number(process.env.BODY_LIMIT_BYTES ?? 1_048_576),
    REQUEST_TIMEOUT_MS: Number(process.env.REQUEST_TIMEOUT_MS ?? 30_000),
    TRUST_PROXY_HOPS: Number(process.env.TRUST_PROXY_HOPS ?? 0),
    MONITORING_TOKEN: process.env.MONITORING_TOKEN ?? '',
    RATE_LIMIT_PER_MINUTE: Number(process.env.RATE_LIMIT_PER_MINUTE ?? 100),
  };
}
