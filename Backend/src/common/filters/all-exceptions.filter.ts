import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Logger } from 'nestjs-pino';

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string | string[];
  path: string;
  timestamp: string;
  requestId: string;
  details?: unknown;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const databaseError = this.databaseError(exception);
    const infrastructureError = this.infrastructureError(exception);
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : (databaseError?.status ??
          infrastructureError?.status ??
          HttpStatus.INTERNAL_SERVER_ERROR);
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const normalized =
      databaseError ?? infrastructureError ?? this.normalizeResponse(exceptionResponse, status);
    const requestId =
      typeof request.id === 'string'
        ? request.id
        : typeof request.id === 'number'
          ? request.id.toString()
          : 'unknown';

    if (status >= 500) {
      this.logger.error(
        { err: exception, method: request.method, path: request.originalUrl },
        'Unhandled request exception',
      );
    } else {
      this.logger.warn(
        { statusCode: status, method: request.method, path: request.originalUrl },
        'Request rejected',
      );
    }

    const body: ErrorBody = {
      statusCode: status,
      code: normalized.code,
      message: normalized.message,
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
      requestId,
    };
    if ('details' in normalized && normalized.details !== undefined) {
      body.details = normalized.details;
    }
    response.status(status).json(body);
  }

  private normalizeResponse(
    value: string | object | undefined,
    status: number,
  ): { code: string; message: string | string[]; details?: unknown } {
    if (typeof value === 'string') {
      return { code: this.defaultCode(status), message: value };
    }
    if (value && 'message' in value) {
      const candidate = value as { code?: unknown; message: unknown; details?: unknown };
      return {
        code: typeof candidate.code === 'string' ? candidate.code : this.defaultCode(status),
        message:
          typeof candidate.message === 'string' || Array.isArray(candidate.message)
            ? (candidate.message as string | string[])
            : 'Request failed',
        details: candidate.details,
      };
    }
    return {
      code: status === 500 ? 'INTERNAL_SERVER_ERROR' : this.defaultCode(status),
      message: status === 500 ? 'An unexpected error occurred.' : 'Request failed',
    };
  }

  private defaultCode(status: number): string {
    return HttpStatus[status] ?? 'HTTP_ERROR';
  }

  private databaseError(
    exception: unknown,
  ): { status: number; code: string; message: string } | undefined {
    if (typeof exception !== 'object' || exception === null || !('code' in exception)) return;
    const code = (exception as { code?: unknown }).code;
    if (typeof code !== 'string') return;

    if (code === 'P2039') {
      if (this.hasMarker(exception, '23P01')) {
        return {
          status: HttpStatus.CONFLICT,
          code: 'ROOM_ALREADY_BOOKED',
          message: 'One or more selected rooms are no longer available.',
        };
      }
      if (this.hasMarker(exception, '23514')) {
        return {
          status: HttpStatus.CONFLICT,
          code: 'DATABASE_CONSTRAINT_VIOLATION',
          message: 'The requested change violates a business rule.',
        };
      }
    }

    const mappings: Record<string, { status: number; code: string; message: string }> = {
      P2002: {
        status: HttpStatus.CONFLICT,
        code: 'DUPLICATE_RESOURCE',
        message: 'A record with the same unique value already exists.',
      },
      P2003: {
        status: HttpStatus.CONFLICT,
        code: 'RESOURCE_IN_USE',
        message: 'This record is referenced by another resource.',
      },
      P2004: {
        status: HttpStatus.CONFLICT,
        code: 'DATABASE_CONSTRAINT_VIOLATION',
        message: 'The requested change violates a business rule.',
      },
      P2025: {
        status: HttpStatus.NOT_FOUND,
        code: 'RESOURCE_NOT_FOUND',
        message: 'The requested resource was not found.',
      },
      P2034: {
        status: HttpStatus.CONFLICT,
        code: 'TRANSACTION_CONFLICT',
        message: 'The operation conflicted with another update. Please retry.',
      },
    };
    return mappings[code];
  }

  private infrastructureError(
    exception: unknown,
  ): { status: number; code: string; message: string } | undefined {
    if (typeof exception !== 'object' || exception === null) return;
    const candidate = exception as { type?: unknown; cause?: unknown };
    const cause =
      typeof candidate.cause === 'object' && candidate.cause !== null
        ? (candidate.cause as { type?: unknown })
        : undefined;
    const type = candidate.type ?? cause?.type;
    if (type === 'entity.too.large') {
      return {
        status: HttpStatus.PAYLOAD_TOO_LARGE,
        code: 'PAYLOAD_TOO_LARGE',
        message: 'The request body exceeds the allowed size.',
      };
    }
    if (type === 'entity.parse.failed') {
      return {
        status: HttpStatus.BAD_REQUEST,
        code: 'INVALID_JSON',
        message: 'The request body is not valid JSON.',
      };
    }
  }

  private hasMarker(value: unknown, marker: string): boolean {
    const visited = new WeakSet<object>();
    const inspect = (entry: unknown, depth: number): boolean => {
      if (depth > 5) return false;
      if (typeof entry === 'string') return entry.includes(marker);
      if (typeof entry !== 'object' || entry === null || visited.has(entry)) return false;
      visited.add(entry);
      return Object.values(entry).some((child) => inspect(child, depth + 1));
    };
    return inspect(value, 0);
  }
}
