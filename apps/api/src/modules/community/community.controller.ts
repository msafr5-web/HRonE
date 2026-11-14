import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, Public } from '../../common/decorators';
import type { AuthUser } from '../../common/types';
import { PageQuery } from '../../common/utils/pagination';
import { CreateCommentDto, CreatePostDto } from './community.dto';
import { CommunityService } from './community.service';

@Controller('community')
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  @Public()
  @Get('posts')
  list(@Query() q: PageQuery, @CurrentUser() u?: AuthUser) {
    return this.community.list(q, u?.id, q.author);
  }

  @Public()
  @Get('tags/trending')
  trending() {
    return this.community.trendingTags();
  }

  @Public()
  @Get('posts/:id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u?: AuthUser) {
    return this.community.get(id, u?.id);
  }

  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  @Post('posts')
  create(@CurrentUser() u: AuthUser, @Body() dto: CreatePostDto) {
    return this.community.create(u, dto);
  }

  @HttpCode(204)
  @Delete('posts/:id')
  remove(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.community.remove(u, id);
  }

  @HttpCode(200)
  @Post('posts/:id/like')
  like(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.community.like(u.id, id, true);
  }

  @Delete('posts/:id/like')
  unlike(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.community.like(u.id, id, false);
  }

  @Public()
  @Get('posts/:id/comments')
  comments(@Param('id', ParseUUIDPipe) id: string, @Query() q: PageQuery) {
    return this.community.comments(id, q);
  }

  @Throttle({ default: { limit: 60, ttl: 3_600_000 } })
  @Post('posts/:id/comments')
  addComment(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateCommentDto) {
    return this.community.addComment(u, id, dto);
  }

  @HttpCode(204)
  @Delete('comments/:id')
  removeComment(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.community.removeComment(u, id);
  }
}
