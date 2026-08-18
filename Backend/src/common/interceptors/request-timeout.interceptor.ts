import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { catchError, Observable, throwError, TimeoutError, timeout } from 'rxjs';

@Injectable()
export class RequestTimeoutInterceptor implements NestInterceptor {
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.timeoutMs = config.getOrThrow<number>('REQUEST_TIMEOUT_MS');
  }

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      timeout(this.timeoutMs),
      catchError((error: unknown) =>
        error instanceof TimeoutError
          ? throwError(
              () =>
                new RequestTimeoutException({
                  code: 'REQUEST_TIMEOUT',
                  message: 'The request exceeded the allowed processing time.',
                }),
            )
          : throwError(() => error),
      ),
    );
  }
}
