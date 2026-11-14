import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { VERIFIED_EXPERT_KEY } from '../decorators';
import type { AuthedRequest } from '../types';

@Injectable()
export class VerifiedExpertGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(VERIFIED_EXPERT_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!required) return true;
    const user = ctx.switchToHttp().getRequest<AuthedRequest>().user;
    const isExpertRole = user?.role === 'HR_SPECIALIST' || user?.role === 'LEGAL_CONSULTANT';
    if (!user || !isExpertRole || user.verification !== 'VERIFIED') {
      throw new ForbiddenException('Verified expert access required');
    }
    return true;
  }
}
