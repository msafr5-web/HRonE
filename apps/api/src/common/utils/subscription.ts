import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../types';

/** True when the user may see premium content (admins always can). */
export async function hasPremiumAccess(prisma: PrismaService, user?: AuthUser): Promise<boolean> {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  const sub = await prisma.subscription.findFirst({
    where: { userId: user.id, status: 'ACTIVE', currentPeriodEnd: { gt: new Date() } },
    select: { id: true },
  });
  return !!sub;
}
