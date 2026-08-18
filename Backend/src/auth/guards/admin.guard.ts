import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ADMIN_ONLY_KEY } from '../../common/decorators/admin-only.decorator.js';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator.js';
import { SYSTEM_ROLES } from '../auth.constants.js';
import type { RequestUser } from '../auth.types.js';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const adminOnly = this.reflector.getAllAndOverride<boolean>(ADMIN_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic || !adminOnly) return true;

    const user = context.switchToHttp().getRequest<Request & { user?: RequestUser }>().user;
    if (!user?.roles.includes(SYSTEM_ROLES.ADMIN)) {
      throw new ForbiddenException({
        code: 'ADMIN_REQUIRED',
        message: 'Only an administrator can perform this action.',
      });
    }
    return true;
  }
}
