import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../common/types';
import { AUTHOR_SELECT, flatTags, TAG_SELECT } from '../../common/utils/select';
import { cursorArgs, PageQuery, toPage } from '../../common/utils/pagination';
import { normalizeTag, normalizeTags } from '../../common/utils/tags';
import { hasPremiumAccess } from '../../common/utils/subscription';
import { searchTerm } from '../../common/utils/search';
import { NotificationsService } from '../notifications/notifications.service';
import type { CreateReplyDto, CreateThreadDto, ThreadListQuery } from './consultations.dto';

const THREAD_SELECT = {
  id: true,
  title: true,
  body: true,
  isPremium: true,
  isAnonymous: true,
  replyCount: true,
  acceptedReplyId: true,
  createdAt: true,
  authorId: true,
  author: { select: AUTHOR_SELECT },
  tags: TAG_SELECT,
} satisfies Prisma.ThreadSelect;

type ThreadRow = Prisma.ThreadGetPayload<{ select: typeof THREAD_SELECT }>;

const isVerifiedExpert = (u: AuthUser) =>
  (u.role === 'HR_SPECIALIST' || u.role === 'LEGAL_CONSULTANT') && u.verification === 'VERIFIED';

@Injectable()
export class ConsultationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Anonymous threads hide the author from everyone but the author themself. Premium threads lock the body. */
  private shape(t: ThreadRow, viewer: AuthUser | undefined, canReadPremium: boolean) {
    const { authorId, tags, author, ...rest } = t;
    const mine = viewer?.id === authorId;
    const locked = t.isPremium && !canReadPremium && !mine;
    return {
      ...rest,
      body: locked ? t.body.slice(0, 140) + '…' : t.body,
      locked,
      solved: !!t.acceptedReplyId,
      author: t.isAnonymous && !mine ? null : author,
      mine,
      tags: flatTags(tags),
    };
  }

  async list(q: ThreadListQuery, viewer?: AuthUser) {
    const tag = q.tag ? normalizeTag(q.tag) : null;
    const term = searchTerm(q.q);
    const rows = await this.prisma.thread.findMany({
      where: {
        status: 'PUBLISHED',
        // premium bodies are never searchable (would leak locked content through snippets)
        ...(term ? { OR: [{ title: { contains: term, mode: 'insensitive' as const } }, { isPremium: false, body: { contains: term, mode: 'insensitive' as const } }] } : {}),
        ...(tag ? { tags: { some: { tag: { slug: tag.slug } } } } : {}),
        ...(q.filter === 'unanswered' ? { replyCount: 0 } : {}),
        ...(q.filter === 'solved' ? { acceptedReplyId: { not: null } } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: THREAD_SELECT,
      ...cursorArgs(q),
    });
    const page = toPage(rows, q.limit);
    const canPremium = await hasPremiumAccess(this.prisma, viewer);
    return { items: page.items.map((t) => this.shape(t, viewer, canPremium)), nextCursor: page.nextCursor };
  }

  async get(id: string, viewer?: AuthUser) {
    const t = await this.prisma.thread.findFirst({ where: { id, status: 'PUBLISHED' }, select: THREAD_SELECT });
    if (!t) throw new NotFoundException('Thread not found');
    return this.shape(t, viewer, await hasPremiumAccess(this.prisma, viewer));
  }

  async create(user: AuthUser, dto: CreateThreadDto) {
    if (dto.isPremium && user.role !== 'ADMIN' && !isVerifiedExpert(user)) {
      throw new ForbiddenException('Only verified experts can publish premium threads');
    }
    const tags = normalizeTags(dto.tags);
    const created = await this.prisma.$transaction(async (tx) => {
      const tagRows = await Promise.all(tags.map((t) => tx.tag.upsert({ where: { slug: t.slug }, create: t, update: {}, select: { id: true } })));
      return tx.thread.create({
        data: {
          authorId: user.id,
          title: dto.title,
          body: dto.body,
          isAnonymous: !!dto.isAnonymous,
          isPremium: !!dto.isPremium,
          tags: { create: tagRows.map((t) => ({ tagId: t.id })) },
        },
        select: THREAD_SELECT,
      });
    });
    return this.shape(created, user, true);
  }

  async replies(threadId: string, viewer?: AuthUser) {
    const thread = await this.requireReadable(threadId, viewer);
    const rows = await this.prisma.reply.findMany({
      where: { threadId, status: 'PUBLISHED' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, parentId: true, body: true, asExpert: true, score: true, createdAt: true, author: { select: AUTHOR_SELECT } },
      take: 500,
    });
    const votes = viewer
      ? await this.prisma.replyVote.findMany({ where: { userId: viewer.id, replyId: { in: rows.map((r) => r.id) } }, select: { replyId: true, value: true } })
      : [];
    const vm = new Map(votes.map((v) => [v.replyId, v.value]));
    return rows.map((r) => ({ ...r, accepted: r.id === thread.acceptedReplyId, viewerVote: vm.get(r.id) ?? 0 }));
  }

  async reply(user: AuthUser, threadId: string, dto: CreateReplyDto) {
    const thread = await this.requireReadable(threadId, user);
    let parentAuthorId: string | undefined;
    if (dto.parentId) {
      const parent = await this.prisma.reply.findFirst({ where: { id: dto.parentId, threadId, status: 'PUBLISHED' }, select: { parentId: true, authorId: true } });
      if (!parent) throw new NotFoundException('Parent reply not found');
      if (parent.parentId) throw new BadRequestException('Replies can be nested only one level deep');
      parentAuthorId = parent.authorId;
    }
    const [reply] = await this.prisma.$transaction([
      this.prisma.reply.create({
        data: { threadId, authorId: user.id, parentId: dto.parentId, body: dto.body, asExpert: isVerifiedExpert(user) },
        select: { id: true, parentId: true, body: true, asExpert: true, score: true, createdAt: true, author: { select: AUTHOR_SELECT } },
      }),
      this.prisma.thread.update({ where: { id: threadId }, data: { replyCount: { increment: 1 } } }),
    ]);
    void this.notifications.notify({ userId: thread.authorId, actorId: user.id, type: 'THREAD_REPLY', targetType: 'THREAD', targetId: threadId, preview: dto.body });
    if (parentAuthorId && parentAuthorId !== thread.authorId) {
      void this.notifications.notify({ userId: parentAuthorId, actorId: user.id, type: 'REPLY_REPLY', targetType: 'THREAD', targetId: threadId, preview: dto.body });
    }
    return { ...reply, accepted: false, viewerVote: 0 };
  }

  /** Vote value: +1 / -1 / 0 (retract). Score is adjusted by the delta inside one transaction. */
  async vote(user: AuthUser, replyId: string, value: -1 | 0 | 1) {
    const reply = await this.prisma.reply.findFirst({ where: { id: replyId, status: 'PUBLISHED' }, select: { authorId: true, threadId: true } });
    if (!reply) throw new NotFoundException('Reply not found');
    if (reply.authorId === user.id) throw new ForbiddenException('You cannot vote on your own reply');
    await this.requireReadable(reply.threadId, user);
    return this.prisma.$transaction(async (tx) => {
      const prev = await tx.replyVote.findUnique({ where: { replyId_userId: { replyId, userId: user.id } }, select: { value: true } });
      const delta = value - (prev?.value ?? 0);
      if (value === 0) {
        if (prev) await tx.replyVote.delete({ where: { replyId_userId: { replyId, userId: user.id } } });
      } else {
        await tx.replyVote.upsert({
          where: { replyId_userId: { replyId, userId: user.id } },
          create: { replyId, userId: user.id, value },
          update: { value },
        });
      }
      const updated = delta
        ? await tx.reply.update({ where: { id: replyId }, data: { score: { increment: delta } }, select: { score: true } })
        : await tx.reply.findUniqueOrThrow({ where: { id: replyId }, select: { score: true } });
      return { score: updated.score, viewerVote: value };
    });
  }

  async accept(user: AuthUser, threadId: string, replyId: string | null) {
    const t = await this.prisma.thread.findFirst({ where: { id: threadId, status: 'PUBLISHED' }, select: { authorId: true } });
    if (!t) throw new NotFoundException('Thread not found');
    if (t.authorId !== user.id && user.role !== 'ADMIN') throw new ForbiddenException('Only the asker can accept an answer');
    if (replyId) {
      const r = await this.prisma.reply.findFirst({ where: { id: replyId, threadId, parentId: null, status: 'PUBLISHED' }, select: { id: true, authorId: true } });
      if (!r) throw new NotFoundException('Answer not found on this thread');
      await this.prisma.thread.update({ where: { id: threadId }, data: { acceptedReplyId: replyId } });
      void this.notifications.notify({ userId: r.authorId, actorId: user.id, type: 'ANSWER_ACCEPTED', targetType: 'THREAD', targetId: threadId });
      return { acceptedReplyId: replyId };
    }
    await this.prisma.thread.update({ where: { id: threadId }, data: { acceptedReplyId: replyId } });
    return { acceptedReplyId: replyId };
  }

  private async requireReadable(threadId: string, viewer?: AuthUser) {
    const t = await this.prisma.thread.findFirst({
      where: { id: threadId, status: 'PUBLISHED' },
      select: { id: true, isPremium: true, authorId: true, acceptedReplyId: true },
    });
    if (!t) throw new NotFoundException('Thread not found');
    if (t.isPremium && t.authorId !== viewer?.id && !(await hasPremiumAccess(this.prisma, viewer))) {
      throw new ForbiddenException({ message: 'Active subscription required', code: 'PREMIUM_REQUIRED' });
    }
    return t;
  }
}
