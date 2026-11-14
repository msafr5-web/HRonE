import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../common/types';
import { AUTHOR_SELECT, flatTags, TAG_SELECT } from '../../common/utils/select';
import { cursorArgs, PageQuery, toPage } from '../../common/utils/pagination';
import { normalizeTag, normalizeTags } from '../../common/utils/tags';
import { searchTerm } from '../../common/utils/search';
import { NotificationsService } from '../notifications/notifications.service';
import type { CreateCommentDto, CreatePostDto } from './community.dto';

const POST_SELECT = {
  id: true,
  body: true,
  attachments: true,
  likeCount: true,
  commentCount: true,
  createdAt: true,
  author: { select: AUTHOR_SELECT },
  tags: TAG_SELECT,
} satisfies Prisma.PostSelect;

type PostRow = Prisma.PostGetPayload<{ select: typeof POST_SELECT }>;

@Injectable()
export class CommunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private shape(p: PostRow, liked: Set<string>) {
    const { tags, ...rest } = p;
    return { ...rest, tags: flatTags(tags), viewerLiked: liked.has(p.id) };
  }

  private async likedSet(viewerId: string | undefined, ids: string[]) {
    if (!viewerId || !ids.length) return new Set<string>();
    const rows = await this.prisma.postLike.findMany({ where: { userId: viewerId, postId: { in: ids } }, select: { postId: true } });
    return new Set(rows.map((r) => r.postId));
  }

  async list(q: PageQuery, viewerId?: string, authorUsername?: string) {
    const tag = q.tag ? normalizeTag(q.tag) : null;
    const term = searchTerm(q.q);
    const rows = await this.prisma.post.findMany({
      where: {
        status: 'PUBLISHED',
        ...(term ? { body: { contains: term, mode: 'insensitive' as const } } : {}),
        ...(tag ? { tags: { some: { tag: { slug: tag.slug } } } } : {}),
        ...(authorUsername ? { author: { usernameLower: authorUsername.toLowerCase() } } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: POST_SELECT,
      ...cursorArgs(q),
    });
    const page = toPage(rows, q.limit);
    const liked = await this.likedSet(viewerId, page.items.map((p) => p.id));
    return { items: page.items.map((p) => this.shape(p, liked)), nextCursor: page.nextCursor };
  }

  async get(id: string, viewerId?: string) {
    const post = await this.prisma.post.findFirst({ where: { id, status: 'PUBLISHED' }, select: POST_SELECT });
    if (!post) throw new NotFoundException('Post not found');
    return this.shape(post, await this.likedSet(viewerId, [id]));
  }

  async create(user: AuthUser, dto: CreatePostDto) {
    const tags = normalizeTags(dto.tags);
    const post = await this.prisma.$transaction(async (tx) => {
      const tagRows = await Promise.all(
        tags.map((t) => tx.tag.upsert({ where: { slug: t.slug }, create: t, update: {}, select: { id: true } })),
      );
      return tx.post.create({
        data: { authorId: user.id, body: dto.body, tags: { create: tagRows.map((t) => ({ tagId: t.id })) } },
        select: POST_SELECT,
      });
    });
    return this.shape(post, new Set());
  }

  async remove(user: AuthUser, id: string) {
    const post = await this.prisma.post.findUnique({ where: { id }, select: { authorId: true, status: true } });
    if (!post || post.status === 'REMOVED') throw new NotFoundException('Post not found');
    if (post.authorId !== user.id && user.role !== 'ADMIN') throw new ForbiddenException();
    await this.prisma.post.update({ where: { id }, data: { status: 'REMOVED' } });
  }

  async like(userId: string, postId: string, on: boolean) {
    const post = await this.assertPostVisible(postId);
    let created = false;
    const result = await this.prisma.$transaction(async (tx) => {
      if (on) {
        const r = await tx.postLike.createMany({ data: [{ postId, userId }], skipDuplicates: true });
        created = r.count > 0;
        if (r.count) await tx.post.update({ where: { id: postId }, data: { likeCount: { increment: 1 } } });
      } else {
        const r = await tx.postLike.deleteMany({ where: { postId, userId } });
        if (r.count) await tx.post.update({ where: { id: postId }, data: { likeCount: { decrement: 1 } } });
      }
      const p = await tx.post.findUniqueOrThrow({ where: { id: postId }, select: { likeCount: true } });
      return { liked: on, likeCount: p.likeCount };
    });
    if (created) void this.notifications.notify({ userId: post.authorId, actorId: userId, type: 'POST_LIKE', targetType: 'POST', targetId: postId });
    return result;
  }

  async comments(postId: string, q: PageQuery) {
    await this.assertPostVisible(postId);
    const rows = await this.prisma.comment.findMany({
      where: { postId, status: 'PUBLISHED' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, body: true, createdAt: true, author: { select: AUTHOR_SELECT } },
      ...cursorArgs(q),
    });
    return toPage(rows, q.limit);
  }

  async addComment(user: AuthUser, postId: string, dto: CreateCommentDto) {
    const post = await this.assertPostVisible(postId);
    const [comment] = await this.prisma.$transaction([
      this.prisma.comment.create({
        data: { postId, authorId: user.id, body: dto.body },
        select: { id: true, body: true, createdAt: true, author: { select: AUTHOR_SELECT } },
      }),
      this.prisma.post.update({ where: { id: postId }, data: { commentCount: { increment: 1 } } }),
    ]);
    void this.notifications.notify({ userId: post.authorId, actorId: user.id, type: 'POST_COMMENT', targetType: 'POST', targetId: postId, preview: dto.body });
    return comment;
  }

  async removeComment(user: AuthUser, id: string) {
    const c = await this.prisma.comment.findUnique({ where: { id }, select: { authorId: true, postId: true, status: true } });
    if (!c || c.status === 'REMOVED') throw new NotFoundException('Comment not found');
    if (c.authorId !== user.id && user.role !== 'ADMIN') throw new ForbiddenException();
    await this.prisma.$transaction([
      this.prisma.comment.update({ where: { id }, data: { status: 'REMOVED' } }),
      this.prisma.post.update({ where: { id: c.postId }, data: { commentCount: { decrement: 1 } } }),
    ]);
  }

  async trendingTags() {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const rows = await this.prisma.tag.findMany({
      select: {
        slug: true,
        label: true,
        _count: { select: { posts: { where: { post: { status: 'PUBLISHED', createdAt: { gte: since } } } } } },
      },
      orderBy: { posts: { _count: 'desc' } },
      take: 12,
    });
    return rows.filter((r) => r._count.posts > 0).map((r) => ({ slug: r.slug, label: r.label, count: r._count.posts }));
  }

  private async assertPostVisible(id: string) {
    const ok = await this.prisma.post.findFirst({ where: { id, status: 'PUBLISHED' }, select: { id: true, authorId: true } });
    if (!ok) throw new NotFoundException('Post not found');
    return ok;
  }
}
