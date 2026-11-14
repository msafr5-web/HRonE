import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AUTHOR_SELECT } from '../../common/utils/select';
import { cursorArgs, PageQuery, toPage } from '../../common/utils/pagination';
import { isBlockedEitherWay } from '../../common/utils/blocks';
import { MessagingGateway } from './messaging.gateway';
import type { SendMessageDto } from './messaging.dto';

const MESSAGE_SELECT = { id: true, conversationId: true, senderId: true, body: true, createdAt: true, clientMsgId: true } satisfies Prisma.MessageSelect;

/** Conversation rows store the pair in canonical order so (A,B) and (B,A) can never coexist. */
const pair = (a: string, b: string) => (a < b ? ([a, b] as const) : ([b, a] as const));

@Injectable()
export class MessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: MessagingGateway,
  ) {}

  async start(userId: string, username: string) {
    const target = await this.prisma.user.findFirst({ where: { usernameLower: username.toLowerCase(), isActive: true }, select: { id: true } });
    if (!target) throw new NotFoundException('User not found');
    if (target.id === userId) throw new BadRequestException('Cannot message yourself');
    if (await isBlockedEitherWay(this.prisma, userId, target.id)) throw new ForbiddenException({ message: 'Messaging unavailable', code: 'BLOCKED' });
    const [userAId, userBId] = pair(userId, target.id);
    const conv = await this.prisma.conversation.upsert({
      where: { userAId_userBId: { userAId, userBId } },
      create: { userAId, userBId },
      update: {},
      select: { id: true },
    });
    return conv;
  }

  async list(userId: string) {
    const convs = await this.prisma.conversation.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      orderBy: { lastMessageAt: 'desc' },
      take: 30,
      include: {
        userA: { select: AUTHOR_SELECT },
        userB: { select: AUTHOR_SELECT },
        messages: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1, select: MESSAGE_SELECT },
      },
    });
    const mine = new Set((await this.prisma.block.findMany({ where: { blockerId: userId }, select: { blockedId: true } })).map((b) => b.blockedId));
    return Promise.all(
      convs.map(async (c) => {
        const meIsA = c.userAId === userId;
        const lastRead = meIsA ? c.userALastRead : c.userBLastRead;
        const unread = await this.prisma.message.count({
          where: { conversationId: c.id, senderId: { not: userId }, ...(lastRead ? { createdAt: { gt: lastRead } } : {}) },
        });
        return { id: c.id, peer: meIsA ? c.userB : c.userA, lastMessage: c.messages[0] ?? null, lastMessageAt: c.lastMessageAt, unread, blockedByMe: mine.has(meIsA ? c.userBId : c.userAId) };
      }),
    );
  }

  async messages(userId: string, conversationId: string, q: PageQuery) {
    const conv = await this.member(userId, conversationId);
    const rows = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: MESSAGE_SELECT,
      ...cursorArgs(q),
    });
    const peerLastRead = conv.userAId === userId ? conv.userBLastRead : conv.userALastRead;
    return { ...toPage(rows, q.limit), peerLastRead };
  }

  async send(userId: string, conversationId: string, dto: SendMessageDto) {
    const conv = await this.member(userId, conversationId);
    const peerId = conv.userAId === userId ? conv.userBId : conv.userAId;
    if (await isBlockedEitherWay(this.prisma, userId, peerId)) throw new ForbiddenException({ message: 'Messaging unavailable', code: 'BLOCKED' });
    try {
      const msg = await this.prisma.$transaction(async (tx) => {
        const m = await tx.message.create({
          data: { conversationId, senderId: userId, body: dto.body, clientMsgId: dto.clientMsgId },
          select: MESSAGE_SELECT,
        });
        await tx.conversation.update({
          where: { id: conversationId },
          data: { lastMessageAt: m.createdAt, ...(conv.userAId === userId ? { userALastRead: m.createdAt } : { userBLastRead: m.createdAt }) },
        });
        return m;
      });
      this.gateway.emitToUser(peerId, 'message:new', msg);
      return msg;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        // Duplicate clientMsgId → return the original, do not re-deliver.
        return this.prisma.message.findUniqueOrThrow({
          where: { senderId_clientMsgId: { senderId: userId, clientMsgId: dto.clientMsgId } },
          select: MESSAGE_SELECT,
        });
      }
      throw e;
    }
  }

  async markRead(userId: string, conversationId: string) {
    const conv = await this.member(userId, conversationId);
    const now = new Date();
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: conv.userAId === userId ? { userALastRead: now } : { userBLastRead: now },
    });
    this.gateway.emitToUser(conv.userAId === userId ? conv.userBId : conv.userAId, 'message:read', { conversationId, at: now });
    return { readAt: now };
  }

  private async member(userId: string, conversationId: string) {
    const conv = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException('Conversation not found');
    if (conv.userAId !== userId && conv.userBId !== userId) throw new ForbiddenException();
    return conv;
  }
}
