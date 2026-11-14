import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators';
import type { AuthUser } from '../../common/types';
import { PageQuery } from '../../common/utils/pagination';
import { SendMessageDto, StartConversationDto } from './messaging.dto';
import { MessagingService } from './messaging.service';

@Controller('messages')
export class MessagingController {
  constructor(private readonly svc: MessagingService) {}

  @HttpCode(200)
  @Post('conversations')
  start(@CurrentUser() u: AuthUser, @Body() dto: StartConversationDto) {
    return this.svc.start(u.id, dto.username);
  }

  @Get('conversations')
  list(@CurrentUser() u: AuthUser) {
    return this.svc.list(u.id);
  }

  @Get('conversations/:id/messages')
  messages(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Query() q: PageQuery) {
    return this.svc.messages(u.id, id, q);
  }

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('conversations/:id/messages')
  send(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SendMessageDto) {
    return this.svc.send(u.id, id, dto);
  }

  @HttpCode(200)
  @Post('conversations/:id/read')
  read(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.markRead(u.id, id);
  }
}
