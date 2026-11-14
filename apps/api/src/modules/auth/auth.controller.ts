import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser, Public } from '../../common/decorators';
import type { AuthUser } from '../../common/types';
import type { Env } from '../../config/env';
import { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto, TokenDto } from './auth.dto';
import { AuthService, IssuedTokens } from './auth.service';

const COOKIE = 'hrone_rt';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { user, tokens } = await this.auth.register(dto);
    return this.respond(res, user, tokens);
  }

  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { user, tokens } = await this.auth.login(dto);
    return this.respond(res, user, tokens);
  }

  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const { user, tokens } = await this.auth.refresh(req.cookies?.[COOKIE]);
      return this.respond(res, user, tokens);
    } catch (e) {
      res.clearCookie(COOKIE, this.cookieBase());
      throw e;
    }
  }

  @Public()
  @HttpCode(204)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[COOKIE]);
    res.clearCookie(COOKIE, this.cookieBase());
  }

  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 3_600_000 } })
  @Post('forgot-password')
  forgot(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @Post('reset-password')
  reset(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.password);
  }

  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  @Post('verify-email')
  verify(@Body() dto: TokenDto) {
    return this.auth.verifyEmail(dto.token);
  }

  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 3_600_000 } })
  @Post('resend-verification')
  resend(@CurrentUser() user: AuthUser) {
    return this.auth.resendVerification(user.id);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  private cookieBase() {
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: this.config.get('NODE_ENV', { infer: true }) === 'production',
      path: '/api/auth',
    };
  }

  /** Refresh token travels only in an httpOnly cookie; the access token lives in client memory. */
  private respond(res: Response, user: unknown, t: IssuedTokens) {
    res.cookie(COOKIE, t.refreshToken, { ...this.cookieBase(), expires: t.refreshExpiresAt });
    return { user, accessToken: t.accessToken, expiresIn: t.expiresIn };
  }
}
