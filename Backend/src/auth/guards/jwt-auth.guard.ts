import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator.js';
import { UserStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AccessTokenPayload, RequestUser } from '../auth.types.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.bearerToken(request);
    if (!token)
      throw new UnauthorizedException({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication is required.',
      });

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_ACCESS_TOKEN',
        message: 'The access token is invalid or expired.',
      });
    }

    if (!payload.sub || !payload.sid || !payload.hotelId) {
      throw new UnauthorizedException({
        code: 'INVALID_ACCESS_TOKEN',
        message: 'The access token is invalid or expired.',
      });
    }

    const session = await this.prisma.authSession.findFirst({
      where: {
        id: payload.sid,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { hotelId: payload.hotelId, status: UserStatus.ACTIVE, deletedAt: null },
      },
      include: {
        user: {
          include: {
            roles: {
              where: { role: { isActive: true, deletedAt: null } },
              include: { role: { include: { permissions: { include: { permission: true } } } } },
            },
          },
        },
      },
    });
    if (!session) {
      throw new UnauthorizedException({
        code: 'SESSION_INVALID',
        message: 'The session is no longer active.',
      });
    }

    const roleNames = session.user.roles.map(({ role }) => role.name);
    const permissions = [
      ...new Set(
        session.user.roles.flatMap(({ role }) =>
          role.permissions.map(({ permission }) => permission.key),
        ),
      ),
    ];
    const currentUser: RequestUser = {
      id: session.user.id,
      hotelId: session.user.hotelId,
      sessionId: session.id,
      email: session.user.email,
      username: session.user.username,
      fullName: session.user.fullName,
      roles: roleNames,
      permissions,
    };
    request.user = currentUser;
    return true;
  }

  private bearerToken(request: Request): string | undefined {
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
  }
}
