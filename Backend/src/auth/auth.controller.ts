import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { REFRESH_COOKIE_NAME } from './auth.constants.js';
import { AuthService, type AuthenticationResult } from './auth.service.js';
import type { RequestUser } from './auth.types.js';
import { LoginDto } from './dto/login.dto.js';

@ApiTags('authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @ApiOperation({ summary: 'Authenticate and start a seven-day refresh session' })
  @ApiResponse({
    status: 201,
    description: 'Authenticated; refresh token set in an HttpOnly cookie',
  })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Omit<AuthenticationResult, 'refreshToken' | 'refreshExpiresAt'>> {
    this.assertTrustedOrigin(request);
    const result = await this.auth.login(dto, this.metadata(request));
    this.setRefreshCookie(response, result.refreshToken, result.refreshExpiresAt);
    return this.publicResult(result);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('refresh')
  @ApiOperation({ summary: 'Rotate the refresh token and issue a new access token' })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Omit<AuthenticationResult, 'refreshToken' | 'refreshExpiresAt'>> {
    this.assertTrustedOrigin(request);
    const rawToken = request.cookies?.[REFRESH_COOKIE_NAME] as unknown;
    if (typeof rawToken !== 'string' || rawToken.length < 32) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'The refresh session is invalid or expired.',
      });
    }
    const result = await this.auth.refresh(rawToken, this.metadata(request));
    this.setRefreshCookie(response, result.refreshToken, result.refreshExpiresAt);
    return this.publicResult(result);
  }

  @ApiBearerAuth()
  @Post('logout')
  @ApiOperation({ summary: 'Revoke the current session' })
  async logout(
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string }> {
    this.assertTrustedOrigin(request);
    await this.auth.logout(user.id, user.hotelId, user.sessionId, this.metadata(request));
    response.clearCookie(REFRESH_COOKIE_NAME, this.cookieOptions());
    return { message: 'Logged out successfully.' };
  }

  @ApiBearerAuth()
  @Post('logout-all')
  @ApiOperation({ summary: 'Revoke every session for the current user' })
  async logoutAll(
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string }> {
    this.assertTrustedOrigin(request);
    await this.auth.logoutAll(user.id, user.hotelId, user.sessionId, this.metadata(request));
    response.clearCookie(REFRESH_COOKIE_NAME, this.cookieOptions());
    return { message: 'All sessions were logged out successfully.' };
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Return the authenticated user and effective permissions' })
  me(@CurrentUser() user: RequestUser): RequestUser {
    return user;
  }

  private publicResult(
    result: AuthenticationResult,
  ): Omit<AuthenticationResult, 'refreshToken' | 'refreshExpiresAt'> {
    return { accessToken: result.accessToken, expiresIn: result.expiresIn, user: result.user };
  }

  private metadata(request: Request): { ipAddress?: string; userAgent?: string } {
    return { ipAddress: request.ip, userAgent: request.headers['user-agent'] };
  }

  private setRefreshCookie(response: Response, token: string, expires: Date): void {
    response.cookie(REFRESH_COOKIE_NAME, token, { ...this.cookieOptions(), expires });
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.getOrThrow<boolean>('AUTH_COOKIE_SECURE'),
      sameSite: 'lax',
      path: '/api/v1/auth',
    };
  }

  private assertTrustedOrigin(request: Request): void {
    const origin = request.headers.origin;
    if (origin && !this.config.getOrThrow<string[]>('CORS_ORIGINS').includes(origin)) {
      throw new ForbiddenException({
        code: 'UNTRUSTED_ORIGIN',
        message: 'The request origin is not allowed.',
      });
    }
  }
}
