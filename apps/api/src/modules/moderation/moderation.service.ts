import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AUTHOR_SELECT } from '../../common/utils/select';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { CreateReportDto, GrantDto } from './moderation.dto';

@Injectable()
export class ModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subs: SubscriptionsService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── user-facing ──
  async report(reporterId: string, dto: CreateReportDto) {
    if (!(await this.targetExists(dto.targetType, dto.targetId))) throw new NotFoundException('Target not found');
    if (dto.targetType === 'USER' && dto.targetId === reporterId) throw new ConflictException('Cannot report yourself');
    await this.prisma.report.upsert({
      where: { reporterId_targetType_targetId: { reporterId, targetType: dto.targetType, targetId: dto.targetId } },
      create: { reporterId, ...dto },
      update: {},
    });
    return { reported: true };
  }

  // ── admin ──
  /** Open reports, each enriched with a content preview + in-app link so moderators can judge in context. */
  async openReports() {
    const rows = await this.prisma.report.findMany({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'asc' },
      take: 100,
      select: { id: true, targetType: true, targetId: true, reason: true, createdAt: true, reporter: { select: AUTHOR_SELECT } },
    });
    return Promise.all(rows.map(async (r) => ({ ...r, ...(await this.describeTarget(r.targetType, r.targetId)) })));
  }

  private async describeTarget(type: CreateReportDto['targetType'], id: string): Promise<{ preview: string | null; href: string | null; authorId: string | null; authorName: string | null }> {
    const cut = (s: string) => (s.length > 200 ? s.slice(0, 200) + '…' : s);
    const author = { select: { id: true, displayName: true } };
    const none = { preview: null, href: null, authorId: null, authorName: null };
    switch (type) {
      case 'POST': {
        const x = await this.prisma.post.findUnique({ where: { id }, select: { body: true, author } });
        return x ? { preview: cut(x.body), href: `/community/${id}`, authorId: x.author.id, authorName: x.author.displayName } : none;
      }
      case 'THREAD': {
        const x = await this.prisma.thread.findUnique({ where: { id }, select: { title: true, body: true, author } });
        return x ? { preview: cut(`${x.title} — ${x.body}`), href: `/consultations/${id}`, authorId: x.author.id, authorName: x.author.displayName } : none;
      }
      case 'COMMENT': {
        const x = await this.prisma.comment.findUnique({ where: { id }, select: { body: true, postId: true, author } });
        return x ? { preview: cut(x.body), href: `/community/${x.postId}`, authorId: x.author.id, authorName: x.author.displayName } : none;
      }
      case 'REPLY': {
        const x = await this.prisma.reply.findUnique({ where: { id }, select: { body: true, threadId: true, author } });
        return x ? { preview: cut(x.body), href: `/consultations/${x.threadId}`, authorId: x.author.id, authorName: x.author.displayName } : none;
      }
      case 'USER': {
        const x = await this.prisma.user.findUnique({ where: { id }, select: { id: true, username: true, displayName: true } });
        return x ? { preview: `@${x.username}`, href: `/u/${x.username}`, authorId: x.id, authorName: x.displayName } : none;
      }
    }
  }

  async actionReport(id: string, hide: boolean) {
    const r = await this.prisma.report.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Report not found');
    if (hide) await this.hideTarget(r.targetType, r.targetId);
    await this.prisma.report.updateMany({
      where: { targetType: r.targetType, targetId: r.targetId, status: 'OPEN' },
      data: { status: hide ? 'ACTIONED' : 'DISMISSED', resolvedAt: new Date() },
    });
    return { status: hide ? 'ACTIONED' : 'DISMISSED' };
  }

  pendingVerifications() {
    return this.prisma.expertVerification.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: 100,
      select: { id: true, requestedRole: true, notes: true, documents: true, createdAt: true, user: { select: { ...AUTHOR_SELECT, bio: true } } },
    });
  }

  async reviewVerification(id: string, reviewerId: string, approve: boolean, note?: string) {
    const v = await this.prisma.expertVerification.findUnique({ where: { id } });
    if (!v || v.status !== 'PENDING') throw new NotFoundException('No pending request');
    const status = approve ? 'VERIFIED' : 'REJECTED';
    await this.prisma.$transaction([
      this.prisma.expertVerification.update({ where: { id }, data: { status, reviewerId, reviewNote: note, reviewedAt: new Date() } }),
      this.prisma.user.update({
        where: { id: v.userId },
        data: approve ? { role: v.requestedRole, verification: 'VERIFIED' } : { verification: 'REJECTED' },
      }),
    ]);
    void this.notifications.notify({ userId: v.userId, type: approve ? 'VERIFICATION_APPROVED' : 'VERIFICATION_REJECTED', targetType: 'USER', targetId: v.userId, preview: note });
    return { status };
  }

  async revokeExpert(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { role: 'EMPLOYEE', verification: 'REVOKED' } });
    return { revoked: true };
  }

  async setActive(userId: string, isActive: boolean) {
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { isActive } }),
      // Deactivation also kills every session.
      ...(!isActive ? [this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } })] : []),
    ]);
    return { isActive };
  }

  async grantSubscription(dto: GrantDto) {
    const user = await this.prisma.user.findFirst({ where: { usernameLower: dto.username.toLowerCase() }, select: { id: true } });
    if (!user) throw new NotFoundException('User not found');
    return this.subs.grant(user.id, dto.interval, dto.days);
  }

  // ── helpers ──
  private async targetExists(type: CreateReportDto['targetType'], id: string) {
    const where = { id };
    switch (type) {
      case 'POST': return !!(await this.prisma.post.findFirst({ where: { ...where, status: 'PUBLISHED' }, select: { id: true } }));
      case 'COMMENT': return !!(await this.prisma.comment.findFirst({ where: { ...where, status: 'PUBLISHED' }, select: { id: true } }));
      case 'THREAD': return !!(await this.prisma.thread.findFirst({ where: { ...where, status: 'PUBLISHED' }, select: { id: true } }));
      case 'REPLY': return !!(await this.prisma.reply.findFirst({ where: { ...where, status: 'PUBLISHED' }, select: { id: true } }));
      case 'USER': return !!(await this.prisma.user.findFirst({ where: { ...where, isActive: true }, select: { id: true } }));
    }
  }

  private async hideTarget(type: CreateReportDto['targetType'], id: string) {
    switch (type) {
      case 'POST':
        await this.prisma.post.updateMany({ where: { id, status: 'PUBLISHED' }, data: { status: 'HIDDEN' } });
        break;
      case 'THREAD':
        await this.prisma.thread.updateMany({ where: { id, status: 'PUBLISHED' }, data: { status: 'HIDDEN' } });
        break;
      case 'COMMENT': {
        const c = await this.prisma.comment.findFirst({ where: { id, status: 'PUBLISHED' }, select: { postId: true } });
        if (c) await this.prisma.$transaction([
          this.prisma.comment.update({ where: { id }, data: { status: 'HIDDEN' } }),
          this.prisma.post.update({ where: { id: c.postId }, data: { commentCount: { decrement: 1 } } }),
        ]);
        break;
      }
      case 'REPLY': {
        const r = await this.prisma.reply.findFirst({ where: { id, status: 'PUBLISHED' }, select: { threadId: true } });
        if (r) await this.prisma.$transaction([
          this.prisma.reply.update({ where: { id }, data: { status: 'HIDDEN' } }),
          this.prisma.thread.update({ where: { id: r.threadId }, data: { replyCount: { decrement: 1 } } }),
        ]);
        break;
      }
      case 'USER':
        await this.setActive(id, false);
        break;
    }
  }
}
