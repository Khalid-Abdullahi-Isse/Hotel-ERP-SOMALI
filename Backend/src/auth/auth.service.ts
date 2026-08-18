import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { UserStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { LoginDto } from './dto/login.dto.js';
import { PasswordService } from './password.service.js';

interface RequestMetadata {
  ipAddress?: string;
  userAgent?: string;
}

interface AuthenticatedUserView {
  id: string;
  hotelId: string;
  email: string;
  username: string;
  fullName: string;
  roles: string[];
  permissions: string[];
}

export interface AuthenticationResult {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: Date;
  user: AuthenticatedUserView;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly dummyHash: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly passwords: PasswordService,
    private readonly auditLogs: AuditLogsService,
  ) {
    this.dummyHash = this.passwords.hash(randomBytes(24).toString('base64url'));
  }

  async login(dto: LoginDto, metadata: RequestMetadata): Promise<AuthenticationResult> {
    const identifier = dto.identifier.trim().toLowerCase();
    let user = await this.prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { username: identifier }] },
      include: this.userAuthorizationInclude(),
    });

    if (!user) {
      await this.passwords.verify(await this.dummyHash, dto.password);
      this.logger.warn({ ipAddress: metadata.ipAddress }, 'Authentication failed');
      throw this.invalidCredentials();
    }

    const now = new Date();
    if (user.status === UserStatus.LOCKED && user.lockedUntil && user.lockedUntil <= now) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { status: UserStatus.ACTIVE, failedLoginAttempts: 0, lockedUntil: null },
        include: this.userAuthorizationInclude(),
      });
    }

    if (
      user.status !== UserStatus.ACTIVE ||
      user.deletedAt ||
      (user.lockedUntil && user.lockedUntil > now)
    ) {
      await this.passwords.verify(user.passwordHash, dto.password);
      this.logger.warn(
        { userId: user.id, ipAddress: metadata.ipAddress },
        'Authentication rejected',
      );
      throw this.invalidCredentials();
    }

    const validPassword = await this.passwords.verify(user.passwordHash, dto.password);
    if (!validPassword) {
      await this.recordFailedLogin(user.id, metadata);
      throw this.invalidCredentials();
    }

    const sessionId = randomUUID();
    const refreshTokenId = randomUUID();
    const rawRefreshToken = this.generateRefreshToken();
    const refreshExpiresAt = this.refreshExpiry();
    const passwordHash = this.passwords.needsRehash(user.passwordHash)
      ? await this.passwords.hash(dto.password)
      : undefined;

    await this.prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: now,
          ...(passwordHash ? { passwordHash } : {}),
        },
      });
      await transaction.authSession.create({
        data: {
          id: sessionId,
          userId: user.id,
          expiresAt: refreshExpiresAt,
          createdByIp: metadata.ipAddress,
          userAgent: metadata.userAgent?.slice(0, 512),
          refreshTokens: {
            create: {
              id: refreshTokenId,
              tokenHash: this.hashRefreshToken(rawRefreshToken),
              expiresAt: refreshExpiresAt,
            },
          },
        },
      });
      await this.auditLogs.record(
        {
          hotelId: user.hotelId,
          userId: user.id,
          action: 'auth.login',
          entityType: 'AuthSession',
          entityId: sessionId,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
        transaction,
      );
    });

    return {
      accessToken: await this.issueAccessToken(user.id, user.hotelId, sessionId),
      expiresIn: this.config.getOrThrow<number>('ACCESS_TOKEN_TTL_SECONDS'),
      refreshToken: rawRefreshToken,
      refreshExpiresAt,
      user: this.toUserView(user),
    };
  }

  async refresh(rawToken: string, metadata: RequestMetadata): Promise<AuthenticationResult> {
    const token = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashRefreshToken(rawToken) },
      include: {
        session: { include: { user: { include: this.userAuthorizationInclude() } } },
      },
    });
    if (!token) throw this.invalidRefreshToken();

    const now = new Date();
    const { session } = token;
    const user = session.user;
    const invalid =
      token.usedAt !== null ||
      token.revokedAt !== null ||
      token.expiresAt <= now ||
      session.revokedAt !== null ||
      session.expiresAt <= now ||
      user.status !== UserStatus.ACTIVE ||
      user.deletedAt !== null;

    if (invalid) {
      await this.revokeSession(session.id, 'refresh token reuse or invalid session');
      this.logger.warn({ sessionId: session.id, userId: user.id }, 'Refresh token rejected');
      throw this.invalidRefreshToken();
    }

    const newTokenId = randomUUID();
    const newRawToken = this.generateRefreshToken();
    const rotated = await this.prisma.$transaction(async (transaction) => {
      const claimed = await transaction.refreshToken.updateMany({
        where: { id: token.id, usedAt: null, revokedAt: null },
        data: { usedAt: now, revokedAt: now },
      });
      if (claimed.count !== 1) {
        await transaction.authSession.updateMany({
          where: { id: session.id, revokedAt: null },
          data: { revokedAt: now, revokeReason: 'concurrent refresh token reuse' },
        });
        return false;
      }

      await transaction.refreshToken.create({
        data: {
          id: newTokenId,
          sessionId: session.id,
          tokenHash: this.hashRefreshToken(newRawToken),
          expiresAt: session.expiresAt,
        },
      });
      await transaction.refreshToken.update({
        where: { id: token.id },
        data: { replacedBy: newTokenId },
      });
      await transaction.authSession.update({
        where: { id: session.id },
        data: { lastSeenAt: now, userAgent: metadata.userAgent?.slice(0, 512) },
      });
      return true;
    });

    if (!rotated) throw this.invalidRefreshToken();
    return {
      accessToken: await this.issueAccessToken(user.id, user.hotelId, session.id),
      expiresIn: this.config.getOrThrow<number>('ACCESS_TOKEN_TTL_SECONDS'),
      refreshToken: newRawToken,
      refreshExpiresAt: session.expiresAt,
      user: this.toUserView(user),
    };
  }

  async logout(
    userId: string,
    hotelId: string,
    sessionId: string,
    metadata: RequestMetadata,
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.authSession.updateMany({
        where: { id: sessionId, userId, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: 'user logout' },
      });
      await this.auditLogs.record(
        {
          hotelId,
          userId,
          action: 'auth.logout',
          entityType: 'AuthSession',
          entityId: sessionId,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
        transaction,
      );
    });
  }

  async logoutAll(
    userId: string,
    hotelId: string,
    sessionId: string,
    metadata: RequestMetadata,
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: 'user logout all' },
      });
      await this.auditLogs.record(
        {
          hotelId,
          userId,
          action: 'auth.logout_all',
          entityType: 'AuthSession',
          entityId: sessionId,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
        transaction,
      );
    });
  }

  private async recordFailedLogin(userId: string, metadata: RequestMetadata): Promise<void> {
    const maxAttempts = this.config.getOrThrow<number>('AUTH_MAX_FAILED_ATTEMPTS');
    const lockMinutes = this.config.getOrThrow<number>('AUTH_LOCK_MINUTES');
    await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;
      const current = await transaction.user.findUniqueOrThrow({ where: { id: userId } });
      const attempts = current.failedLoginAttempts + 1;
      const locked = attempts >= maxAttempts;
      const lockedUntil = locked ? new Date(Date.now() + lockMinutes * 60_000) : null;
      await transaction.user.update({
        where: { id: userId },
        data: {
          failedLoginAttempts: attempts,
          ...(locked ? { status: UserStatus.LOCKED, lockedUntil } : {}),
        },
      });
      await this.auditLogs.record(
        {
          hotelId: current.hotelId,
          userId: current.id,
          action: locked ? 'auth.account_locked' : 'auth.login_failed',
          entityType: 'User',
          entityId: current.id,
          newValue: {
            failedLoginAttempts: attempts,
            lockedUntil: lockedUntil?.toISOString() ?? null,
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
        transaction,
      );
    });
    this.logger.warn({ userId, ipAddress: metadata.ipAddress }, 'Authentication failed');
  }

  private revokeSession(sessionId: string, reason: string): Promise<{ count: number }> {
    return this.prisma.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: reason },
    });
  }

  private issueAccessToken(userId: string, hotelId: string, sessionId: string): Promise<string> {
    return this.jwt.signAsync({ sub: userId, hotelId, sid: sessionId });
  }

  private refreshExpiry(): Date {
    const days = this.config.getOrThrow<number>('REFRESH_TOKEN_TTL_DAYS');
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private generateRefreshToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private invalidCredentials(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'INVALID_CREDENTIALS',
      message: 'The username or password is incorrect.',
    });
  }

  private invalidRefreshToken(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'INVALID_REFRESH_TOKEN',
      message: 'The refresh session is invalid or expired.',
    });
  }

  private userAuthorizationInclude() {
    return {
      roles: {
        where: { role: { isActive: true, deletedAt: null } },
        include: { role: { include: { permissions: { include: { permission: true } } } } },
      },
    } as const;
  }

  private toUserView(user: {
    id: string;
    hotelId: string;
    email: string;
    username: string;
    fullName: string;
    roles: Array<{
      role: { name: string; permissions: Array<{ permission: { key: string } }> };
    }>;
  }): AuthenticatedUserView {
    return {
      id: user.id,
      hotelId: user.hotelId,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      roles: user.roles.map(({ role }) => role.name),
      permissions: [
        ...new Set(
          user.roles.flatMap(({ role }) =>
            role.permissions.map(({ permission }) => permission.key),
          ),
        ),
      ],
    };
  }
}
