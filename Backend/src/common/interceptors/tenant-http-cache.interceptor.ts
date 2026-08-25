import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';
import { createHash, randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { from, map, mergeMap, Observable, of } from 'rxjs';
import type { RequestUser } from '../../auth/auth.types.js';

type AuthenticatedRequest = Request & { user?: RequestUser };

@Injectable()
export class TenantHttpCacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TenantHttpCacheInterceptor.name);
  private readonly ttl: number;

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    config: ConfigService,
  ) {
    this.ttl = config.getOrThrow<number>('CACHE_TTL_MS');
  }

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const actor = request.user;
    if (!actor || this.isExcluded(request)) return next.handle();

    if (request.method === 'GET' && this.isCacheableGet(request)) {
      const key = await this.responseKey(request, actor);
      const cached = await this.safeGet(key);
      if (cached !== undefined) return of(cached);

      const responseStream = next.handle() as Observable<unknown>;
      return responseStream.pipe(
        mergeMap((value) => from(this.safeSet(key, value)).pipe(map(() => value))),
      );
    }

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      const responseStream = next.handle() as Observable<unknown>;
      return responseStream.pipe(
        mergeMap((value) => from(this.invalidate(actor.hotelId)).pipe(map(() => value))),
      );
    }

    return next.handle();
  }

  private isCacheableGet(request: Request): boolean {
    return [
      /\/dashboard\/summary$/,
      /\/hotels\/current$/,
      /\/floors$/,
      /\/room-types$/,
      /\/services$/,
      /\/payment-methods$/,
      /\/expense-categories$/,
      /\/roles(?:\/permissions)?$/,
    ].some((pattern) => pattern.test(request.path));
  }

  private isExcluded(request: Request): boolean {
    const path = request.path;
    return path.includes('/auth/') || path.includes('/health/');
  }

  private async responseKey(request: Request, actor: RequestUser): Promise<string> {
    const version = (await this.safeGet<string>(this.versionKey(actor.hotelId))) ?? 'initial';
    const requestHash = createHash('sha256').update(request.originalUrl).digest('hex');
    return `http-cache:${actor.hotelId}:${actor.id}:${version}:${requestHash}`;
  }

  private versionKey(hotelId: string): string {
    return `http-cache-version:${hotelId}`;
  }

  private async invalidate(hotelId: string): Promise<void> {
    await this.safeSet(this.versionKey(hotelId), randomUUID(), undefined);
  }

  private async safeGet<T>(key: string): Promise<T | undefined> {
    try {
      return await this.cache.get<T>(key);
    } catch (error) {
      this.logger.warn({ error, key }, 'Redis cache read failed; continuing without cache');
      return undefined;
    }
  }

  private async safeSet(
    key: string,
    value: unknown,
    ttl: number | undefined = this.ttl,
  ): Promise<void> {
    try {
      if (ttl === undefined) await this.cache.set(key, value);
      else await this.cache.set(key, value, ttl);
    } catch (error) {
      this.logger.warn({ error, key }, 'Redis cache write failed; continuing without cache');
    }
  }
}
