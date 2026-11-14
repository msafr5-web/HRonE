import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AUTHOR_SELECT } from '../../common/utils/select';
import { SELF_SELECT } from '../auth/auth.service';
import { searchTerm } from '../../common/utils/search';
import { NotificationsService } from '../notifications/notifications.service';
import type { UpdateProfileDto, VerificationRequestDto } from './users.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async profile(username: string, viewerId?: string) {
    const user = await this.prisma.user.findFirst({
      where: { usernameLower: username.toLowerCase(), isActive: true },
      select: {
        ...AUTHOR_SELECT,
        bio: true,
        createdAt: true,
        _count: { select: { followers: true, following: true, posts: { where: { status: 'PUBLISHED' } } } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const viewerFollows = viewerId
      ? !!(await this.prisma.follow.findUnique({
          where: { followerId_followingId: { followerId: viewerId, followingId: user.id } },
          select: { followerId: true },
        }))
      : false;
    const viewerBlocked = viewerId
      ? !!(await this.prisma.block.findUnique({ where: { blockerId_blockedId: { blockerId: viewerId, blockedId: user.id } }, select: { blockerId: true } }))
      : false;
    const { _count, ...rest } = user;
    return {
      ...rest,
      followerCount: _count.followers,
      followingCount: _count.following,
      postCount: _count.posts,
      viewerFollows,
      viewerBlocked,
    };
  }

  updateMe(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({ where: { id: userId }, data: dto, select: SELF_SELECT });
  }

  async search(q: string, viewerId: string) {
    const term = q.trim().toLowerCase();
    if (term.length < 2) return [];
    return this.prisma.user.findMany({
      where: {
        isActive: true,
        id: { not: viewerId },
        OR: [{ usernameLower: { startsWith: term } }, { displayName: { contains: term, mode: 'insensitive' } }],
      },
      select: AUTHOR_SELECT,
      take: 8,
    });
  }

  async follow(viewerId: string, username: string) {
    const target = await this.prisma.user.findFirst({ where: { usernameLower: username.toLowerCase(), isActive: true }, select: { id: true } });
    if (!target) throw new NotFoundException('User not found');
    if (target.id === viewerId) throw new BadRequestException('Cannot follow yourself');
    await this.prisma.follow.upsert({
      where: { followerId_followingId: { followerId: viewerId, followingId: target.id } },
      create: { followerId: viewerId, followingId: target.id },
      update: {},
    });
    void this.notifications.notify({ userId: target.id, actorId: viewerId, type: 'NEW_FOLLOWER', targetType: 'USER', targetId: viewerId });
    return { following: true };
  }

  async unfollow(viewerId: string, username: string) {
    const target = await this.prisma.user.findFirst({ where: { usernameLower: username.toLowerCase() }, select: { id: true } });
    if (target) await this.prisma.follow.deleteMany({ where: { followerId: viewerId, followingId: target.id } });
    return { following: false };
  }

  /** Public people search (profile discovery). */
  async directory(q: string) {
    const term = searchTerm(q);
    if (!term) return [];
    return this.prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { usernameLower: { contains: term.toLowerCase() } },
          { displayName: { contains: term, mode: 'insensitive' } },
          { headline: { contains: term, mode: 'insensitive' } },
        ],
      },
      select: AUTHOR_SELECT,
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }

  async block(viewerId: string, username: string) {
    const target = await this.prisma.user.findFirst({ where: { usernameLower: username.toLowerCase(), isActive: true }, select: { id: true, role: true } });
    if (!target) throw new NotFoundException('User not found');
    if (target.id === viewerId) throw new BadRequestException('Cannot block yourself');
    if (target.role === 'ADMIN') throw new BadRequestException('Administrators cannot be blocked');
    await this.prisma.$transaction([
      this.prisma.block.upsert({ where: { blockerId_blockedId: { blockerId: viewerId, blockedId: target.id } }, create: { blockerId: viewerId, blockedId: target.id }, update: {} }),
      // blocking severs follows in both directions
      this.prisma.follow.deleteMany({ where: { OR: [{ followerId: viewerId, followingId: target.id }, { followerId: target.id, followingId: viewerId }] } }),
    ]);
    return { blocked: true };
  }

  async unblock(viewerId: string, username: string) {
    const target = await this.prisma.user.findFirst({ where: { usernameLower: username.toLowerCase() }, select: { id: true } });
    if (target) await this.prisma.block.deleteMany({ where: { blockerId: viewerId, blockedId: target.id } });
    return { blocked: false };
  }

  async requestVerification(userId: string, dto: VerificationRequestDto) {
    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { verification: true } });
    if (me.verification === 'PENDING') throw new ConflictException('A verification request is already pending');
    if (me.verification === 'VERIFIED') throw new ConflictException('Already verified');
    const [req] = await this.prisma.$transaction([
      this.prisma.expertVerification.create({
        data: { userId, requestedRole: dto.requestedRole, notes: dto.notes, documents: dto.documents ?? [] },
        select: { id: true, status: true, requestedRole: true, createdAt: true },
      }),
      this.prisma.user.update({ where: { id: userId }, data: { verification: 'PENDING' } }),
    ]);
    return req;
  }
}
