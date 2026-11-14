import { Body, Controller, Get, Headers, HttpCode, Param, Post, Req } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser, Premium, Public } from '../../common/decorators';
import type { AuthUser } from '../../common/types';
import { NormalizedEvent, SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly svc: SubscriptionsService) {}

  @Get('me')
  mine(@CurrentUser() u: AuthUser) {
    return this.svc.mine(u.id);
  }

  /** Example of a premium-only route guarded by @Premium(). */
  @Premium()
  @Get('premium-check')
  premiumCheck() {
    return { ok: true };
  }

  @Public()
  @SkipThrottle()
  @HttpCode(200)
  @Post('webhooks/:provider')
  webhook(
    @Param('provider') provider: string,
    @Headers('x-signature') signature: string | undefined,
    @Req() req: Request & { rawBody?: Buffer },
    @Body() body: NormalizedEvent,
  ) {
    this.svc.verifySignature(req.rawBody, signature);
    return this.svc.handleEvent(provider.slice(0, 32), body);
  }
}
