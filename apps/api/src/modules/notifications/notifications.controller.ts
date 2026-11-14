import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import type { AuthUser } from '../../common/types';
import { PageQuery } from '../../common/utils/pagination';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  list(@CurrentUser() u: AuthUser, @Query() q: PageQuery) {
    return this.svc.list(u.id, q);
  }

  // static routes before ':id' so they are not shadowed
  @Get('unread-count')
  async unread(@CurrentUser() u: AuthUser) {
    return { unread: await this.svc.unreadCount(u.id) };
  }

  @HttpCode(200)
  @Post('read-all')
  readAll(@CurrentUser() u: AuthUser) {
    return this.svc.readAll(u.id);
  }

  @HttpCode(200)
  @Post(':id/read')
  read(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.markRead(u.id, id);
  }
}
