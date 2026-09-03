import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from '../../auth/auth.constants.js';

export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';
export const RequirePermissions = (
  ...permissions: PermissionKey[]
): MethodDecorator & ClassDecorator => SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);

export const RequireAnyPermission = (
  ...permissions: PermissionKey[]
): MethodDecorator & ClassDecorator => SetMetadata(REQUIRED_PERMISSIONS_KEY, { any: permissions });
