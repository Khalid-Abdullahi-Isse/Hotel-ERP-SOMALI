import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { REQUIRED_PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator.js';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator.js';
import type { PermissionKey } from '../auth.constants.js';
import type { RequestUser } from '../auth.types.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    const required = this.reflector.getAllAndOverride<PermissionKey[] | { any: PermissionKey[] }>(REQUIRED_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || (Array.isArray(required) && !required.length) || (!Array.isArray(required) && !required.any.length)) return true;

    const user = context.switchToHttp().getRequest<Request & { user?: RequestUser }>().user;
    const allowed = Array.isArray(required)
      ? required.every((permission) => user?.permissions.includes(permission))
      : required.any.some((permission) => user?.permissions.includes(permission));
    if (!user || !allowed) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'You do not have permission to perform this action.',
      });
    }
    return true;
  }
}
