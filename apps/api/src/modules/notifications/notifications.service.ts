import { Injectable, Logger } from '@nestjs/common';
import type { NotificationType } from '@prisma/client';
import { AUTHOR_SELECT } from '../../common/utils/select';
import { cursorArgs, PageQuery, toPage } from '../../common/utils/pagination';
import { PrismaService } from '../../prisma/prisma.service';

export interface NotifyInput {
  userId: string;
  actorId?: string | null;
  type: NotificationType;
  targetType?: 'POST' | 'THREAD' | 'USER';
  targetId?: string;
  preview?: string;
}

/** Likes and follows are de-duplicated (one notification per actor+target) so repeat taps cannot spam someone. */
const DEDUPE = new Set<NotificationType>(['POST_LIKE', 'NEW_FOLLOWER']);

@Injectable()
export class NotificationsService {
  private readonly log = new Logger(NotificationsService.name);
  constructor(private readonly prisma: PrismaService) {}

  /** Never throws – a notification failure must not break the action that caused it. */
  async notify(n: NotifyInput): Promise<void> {
    try {
      if (n.actorId && n.actorId === n.userId) return;
      if (DEDUPE.has(n.type)) {
        const dup = await this.prisma.notification.findFirst({
          where: { userId: n.userId, actorId: n.actorId ?? null, type: n.type, targetId: n.targetId ?? null },
          select: { id: true },
        });
        if (dup) return;
      }
      await this.prisma.notification.create({
        data: {
          userId: n.userId,
          actorId: n.actorId ?? null,
          type: n.type,
          targetType: n.targetType,
          targetId: n.targetId,
          preview: n.preview ? (n.preview.length > 140 ? n.preview.slice(0, 140) + '…' : n.preview) : undefined,
        },
      });
    } catch (e) {
      this.log.warn(`notify failed: ${(e as Error).message}`);
    }
  }

  async list(userId: string, q: PageQuery) {
    const rows = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true, type: true, targetType: true, targetId: true, preview: true, readAt: true, createdAt: true,
        actor: { select: AUTHOR_SELECT },
      },
      ...cursorArgs(q),
    });
    return { ...toPage(rows, q.limit), unread: await this.unreadCount(userId) };
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
    return { unread: await this.unreadCount(userId) };
  }

  async readAll(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return { unread: 0 };
  }
}
