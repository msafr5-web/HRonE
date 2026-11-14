import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingInterval, Prisma, SubscriptionStatus } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Provider-agnostic subscription ledger.
 * The payment provider is still an open decision (Stripe does not list Saudi Arabia as a supported
 * country at the time of writing; local gateways must be confirmed for mada recurring billing).
 * Any provider adapter only has to POST this normalised event to /subscriptions/webhooks/:provider.
 */
export interface NormalizedEvent {
  id: string;
  type: 'subscription.activated' | 'subscription.renewed' | 'subscription.past_due' | 'subscription.canceled' | 'subscription.expired';
  userId: string;
  providerRef: string;
  interval: BillingInterval;
  currentPeriodEnd: string;
}

const STATUS_BY_TYPE: Record<NormalizedEvent['type'], SubscriptionStatus> = {
  'subscription.activated': 'ACTIVE',
  'subscription.renewed': 'ACTIVE',
  'subscription.past_due': 'PAST_DUE',
  'subscription.canceled': 'CANCELED',
  'subscription.expired': 'EXPIRED',
};

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  mine(userId: string) {
    return this.prisma.subscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, provider: true, interval: true, status: true, currentPeriodEnd: true },
    });
  }

  verifySignature(rawBody: Buffer | undefined, signature: string | undefined) {
    if (!rawBody || !signature) throw new UnauthorizedException('Missing signature');
    const expected = createHmac('sha256', this.config.get('WEBHOOK_SECRET', { infer: true })).update(rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException('Bad signature');
  }

  /** Idempotent: the event row and the state change commit together, so a retry is either a no-op or a full apply. */
  async handleEvent(provider: string, ev: NormalizedEvent) {
    if (!STATUS_BY_TYPE[ev.type] || !ev.id || !ev.userId || !ev.providerRef) throw new BadRequestException('Malformed event');
    const end = new Date(ev.currentPeriodEnd);
    if (Number.isNaN(end.getTime())) throw new BadRequestException('Invalid currentPeriodEnd');
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.webhookEvent.create({ data: { providerEventId: `${provider}:${ev.id}`, provider } });
        await this.upsert(tx, { provider, userId: ev.userId, providerRef: ev.providerRef, interval: ev.interval, status: STATUS_BY_TYPE[ev.type], end });
        await tx.webhookEvent.update({ where: { providerEventId: `${provider}:${ev.id}` }, data: { processedAt: new Date() } });
      });
      return { received: true, duplicate: false };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && String(e.meta?.target).includes('providerEventId')) {
        return { received: true, duplicate: true };
      }
      throw e;
    }
  }

  /** Manual grant (beta users, offline payments). */
  grant(userId: string, interval: BillingInterval, days: number) {
    const end = new Date(Date.now() + days * 86_400_000);
    return this.upsert(this.prisma, {
      provider: 'manual',
      userId,
      providerRef: `manual:${userId}:${Date.now()}`,
      interval,
      status: 'ACTIVE',
      end,
    });
  }

  private upsert(
    db: Prisma.TransactionClient | PrismaService,
    s: { provider: string; userId: string; providerRef: string; interval: BillingInterval; status: SubscriptionStatus; end: Date },
  ) {
    return db.subscription.upsert({
      where: { providerRef: s.providerRef },
      create: { userId: s.userId, provider: s.provider, providerRef: s.providerRef, interval: s.interval, status: s.status, currentPeriodEnd: s.end },
      update: { status: s.status, interval: s.interval, currentPeriodEnd: s.end },
      select: { id: true, status: true, currentPeriodEnd: true },
    });
  }
}
