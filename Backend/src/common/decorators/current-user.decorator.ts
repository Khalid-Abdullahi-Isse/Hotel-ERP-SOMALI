import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { RequestUser } from '../../auth/auth.types.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestUser =>
    context.switchToHttp().getRequest<Request & { user: RequestUser }>().user,
);
