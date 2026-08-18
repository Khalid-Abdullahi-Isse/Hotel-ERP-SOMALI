import { SetMetadata } from '@nestjs/common';

export const ADMIN_ONLY_KEY = 'adminOnly';
export const AdminOnly = (): MethodDecorator & ClassDecorator => SetMetadata(ADMIN_ONLY_KEY, true);
