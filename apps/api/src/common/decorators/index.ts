import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Role } from '@prisma/client';
import type { AuthedRequest, AuthUser } from '../types';

export const IS_PUBLIC = 'isPublic';
export const ROLES_KEY = 'roles';
export const PREMIUM_KEY = 'premium';
export const VERIFIED_EXPERT_KEY = 'verifiedExpert';

/** Route is readable without a token. A valid token is still honoured when present. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Restrict a route to the given roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Restrict a route to users with an active subscription. */
export const Premium = () => SetMetadata(PREMIUM_KEY, true);

/** Restrict a route to verified experts (HR specialist / legal consultant). */
export const VerifiedExpert = () => SetMetadata(VERIFIED_EXPERT_KEY, true);

/** Inject the authenticated user (or undefined on public routes without a token). */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser | undefined => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().user;
});
