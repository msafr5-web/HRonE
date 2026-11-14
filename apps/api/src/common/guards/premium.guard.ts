import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { PREMIUM_KEY } from '../decorators';
import type { AuthedRequest } from '../types';
import { hasPremiumAccess } from '../utils/subscription';

/** Blocks @Premium() routes unless the caller has an ACTIVE, unexpired subscription. */
@Injectable()
export class PremiumGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean>(PREMIUM_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!required) return true;
    const user = ctx.switchToHttp().getRequest<AuthedRequest>().user;
    if (!(await hasPremiumAccess(this.prisma, user))) {
      throw new HttpException({ message: 'Active subscription required', code: 'PREMIUM_REQUIRED' }, HttpStatus.PAYMENT_REQUIRED);
    }
    return true;
  }
}
