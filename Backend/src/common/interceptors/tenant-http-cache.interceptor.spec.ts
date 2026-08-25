import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';
import type { Request } from 'express';
import { lastValueFrom, of } from 'rxjs';
import type { RequestUser } from '../../auth/auth.types.js';
import { TenantHttpCacheInterceptor } from './tenant-http-cache.interceptor.js';

const actor: RequestUser = {
  id: 'user-1',
  hotelId: 'hotel-1',
  sessionId: 'session-1',
  email: 'user@example.com',
  username: 'user',
  fullName: 'Example User',
  roles: ['MANAGER'],
  permissions: ['room.view'],
};

describe('TenantHttpCacheInterceptor', () => {
  let values: Map<string, unknown>;
  let cache: Cache;
  let interceptor: TenantHttpCacheInterceptor;

  beforeEach(() => {
    values = new Map<string, unknown>();
    cache = {
      get: jest.fn(<T>(key: string) => Promise.resolve(values.get(key) as T | undefined)),
      set: jest.fn((key: string, value: unknown) => {
        values.set(key, value);
        return Promise.resolve(value);
      }),
      del: jest.fn((key: string) => Promise.resolve(values.delete(key))),
    } as unknown as Cache;
    interceptor = new TenantHttpCacheInterceptor(
      cache,
      new ConfigService({ CACHE_TTL_MS: 60_000 }),
    );
  });

  it('serves a repeated GET from cache without invoking the handler twice', async () => {
    const first = handler({ rooms: ['101'] });
    const context = httpContext('GET', actor);

    await expect(lastValueFrom(await interceptor.intercept(context, first))).resolves.toEqual({
      rooms: ['101'],
    });

    const second = handler({ rooms: ['should-not-run'] });
    await expect(lastValueFrom(await interceptor.intercept(context, second))).resolves.toEqual({
      rooms: ['101'],
    });
  });

  it('keeps cached responses isolated by hotel and user', async () => {
    await lastValueFrom(
      await interceptor.intercept(httpContext('GET', actor), handler({ hotel: 'one' })),
    );

    const otherActor = { ...actor, id: 'user-2', hotelId: 'hotel-2' };
    const otherHandler = handler({ hotel: 'two' });
    await expect(
      lastValueFrom(await interceptor.intercept(httpContext('GET', otherActor), otherHandler)),
    ).resolves.toEqual({ hotel: 'two' });
  });

  it('invalidates all prior hotel GET keys after a successful mutation', async () => {
    const getContext = httpContext('GET', actor);
    await lastValueFrom(await interceptor.intercept(getContext, handler({ version: 1 })));
    await lastValueFrom(
      await interceptor.intercept(httpContext('PATCH', actor), handler({ updated: true })),
    );

    const refreshed = handler({ version: 2 });
    await expect(
      lastValueFrom(await interceptor.intercept(getContext, refreshed)),
    ).resolves.toEqual({
      version: 2,
    });
  });
});

function handler(value: unknown): CallHandler {
  return { handle: jest.fn(() => of(value)) };
}

function httpContext(method: string, user: RequestUser): ExecutionContext {
  const request = {
    method,
    path: '/api/v1/dashboard/summary',
    originalUrl: '/api/v1/dashboard/summary',
    user,
  } as Request & { user: RequestUser };

  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}
