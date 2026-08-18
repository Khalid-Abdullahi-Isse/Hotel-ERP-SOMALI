import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { finalize, Observable } from 'rxjs';
import { MetricsService } from './metrics.service.js';

type RoutedRequest = Omit<Request, 'route'> & { route?: { path?: unknown } };

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RoutedRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const started = performance.now();

    return next.handle().pipe(
      finalize(() => {
        const candidatePath = request.route?.path;
        const routePath = typeof candidatePath === 'string' ? candidatePath : 'unmatched';
        const route = `${request.baseUrl}${routePath}`;
        this.metrics.observe(
          request.method,
          route,
          response.statusCode,
          performance.now() - started,
        );
      }),
    );
  }
}
