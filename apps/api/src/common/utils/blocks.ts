import type { PrismaService } from '../../prisma/prisma.service';

/** True when either user has blocked the other. */
export async function isBlockedEitherWay(prisma: PrismaService, a: string, b: string): Promise<boolean> {
  const row = await prisma.block.findFirst({
    where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] },
    select: { blockerId: true },
  });
  return !!row;
}
