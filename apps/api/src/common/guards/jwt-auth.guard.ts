import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC } from '../decorators';
import type { AuthedRequest } from '../types';

/**
 * Global guard. Verifies the Bearer access token and loads the *current* user row,
 * so role changes and account deactivation take effect immediately (not after token expiry).
 * Routes marked @Public() stay open but still receive `req.user` when a valid token is sent.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ctx.getType() !== 'http') return true;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException('Authentication required');
    }

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, username: true, role: true, verification: true, isActive: true },
      });
      if (!user || !user.isActive) throw new UnauthorizedException('Account unavailable');
      req.user = { id: user.id, username: user.username, role: user.role, verification: user.verification };
      return true;
    } catch (err) {
      if (isPublic) return true; // bad token on a public route → treat as anonymous
      throw err instanceof UnauthorizedException ? err : new UnauthorizedException('Invalid or expired token');
    }
  }
}
