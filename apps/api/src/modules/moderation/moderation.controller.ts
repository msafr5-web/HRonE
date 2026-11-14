import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, Roles } from '../../common/decorators';
import type { AuthUser } from '../../common/types';
import { CreateReportDto, GrantDto, ReviewDto } from './moderation.dto';
import { ModerationService } from './moderation.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly svc: ModerationService) {}

  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  @Post()
  report(@CurrentUser() u: AuthUser, @Body() dto: CreateReportDto) {
    return this.svc.report(u.id, dto);
  }
}

@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly svc: ModerationService) {}

  @Get('reports')
  reports() {
    return this.svc.openReports();
  }

  @HttpCode(200) @Post('reports/:id/hide')
  hide(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.actionReport(id, true);
  }

  @HttpCode(200) @Post('reports/:id/dismiss')
  dismiss(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.actionReport(id, false);
  }

  @Get('verifications')
  verifications() {
    return this.svc.pendingVerifications();
  }

  @HttpCode(200) @Post('verifications/:id/approve')
  approve(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewDto) {
    return this.svc.reviewVerification(id, u.id, true, dto.note);
  }

  @HttpCode(200) @Post('verifications/:id/reject')
  reject(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewDto) {
    return this.svc.reviewVerification(id, u.id, false, dto.note);
  }

  @HttpCode(200) @Post('users/:id/revoke-expert')
  revoke(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.revokeExpert(id);
  }

  @HttpCode(200) @Post('users/:id/deactivate')
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.setActive(id, false);
  }

  @HttpCode(200) @Post('users/:id/activate')
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.setActive(id, true);
  }

  @HttpCode(200) @Post('subscriptions/grant')
  grant(@Body() dto: GrantDto) {
    return this.svc.grantSubscription(dto);
  }
}
