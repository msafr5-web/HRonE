import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, Public } from '../../common/decorators';
import type { AuthUser } from '../../common/types';
import { CreateReplyDto, CreateThreadDto, ThreadListQuery, VoteDto } from './consultations.dto';
import { ConsultationsService } from './consultations.service';

/**
 * Community Q&A. Content is peer/expert opinion, not licensed legal advice –
 * clients must show the disclaimer next to every thread.
 */
@Controller('consultations')
export class ConsultationsController {
  constructor(private readonly svc: ConsultationsService) {}

  @Public()
  @Get()
  list(@Query() q: ThreadListQuery, @CurrentUser() u?: AuthUser) {
    return this.svc.list(q, u);
  }

  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @Post()
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateThreadDto) {
    return this.svc.create(u, dto);
  }

  @HttpCode(200)
  @Post('replies/:replyId/vote')
  vote(@CurrentUser() u: AuthUser, @Param('replyId', ParseUUIDPipe) replyId: string, @Body() dto: VoteDto) {
    return this.svc.vote(u, replyId, dto.value);
  }

  @Public()
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u?: AuthUser) {
    return this.svc.get(id, u);
  }

  @Public()
  @Get(':id/replies')
  replies(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u?: AuthUser) {
    return this.svc.replies(id, u);
  }

  @Throttle({ default: { limit: 40, ttl: 3_600_000 } })
  @Post(':id/replies')
  reply(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateReplyDto) {
    return this.svc.reply(u, id, dto);
  }

  @HttpCode(200)
  @Post(':id/accept/:replyId')
  accept(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('replyId', ParseUUIDPipe) replyId: string) {
    return this.svc.accept(u, id, replyId);
  }

  @Delete(':id/accept')
  unaccept(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.accept(u, id, null);
  }
}
