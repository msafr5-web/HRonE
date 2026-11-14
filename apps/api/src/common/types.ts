import type { Request } from 'express';
import type { Role, VerificationStatus } from '@prisma/client';

/** The authenticated principal attached to the request by JwtAuthGuard. */
export interface AuthUser {
  id: string;
  username: string;
  role: Role;
  verification: VerificationStatus;
}

export type AuthedRequest = Request & { user?: AuthUser };
