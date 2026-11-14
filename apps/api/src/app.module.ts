import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { Public } from './common/decorators';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PremiumGuard } from './common/guards/premium.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { VerifiedExpertGuard } from './common/guards/verified-expert.guard';
import { validateEnv } from './config/env';
import { AiEngineModule } from './modules/ai-engine/ai-engine.module';
import { AuthModule } from './modules/auth/auth.module';
import { MailModule } from './modules/mail/mail.module';
import { CommunityModule } from './modules/community/community.module';
import { ConsultationsModule } from './modules/consultations/consultations.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaService } from './prisma/prisma.service';

@Controller('health')
class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Rate limiting is bypassed only under NODE_ENV=test (automated smoke runs).
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 120 }], skipIf: () => process.env.NODE_ENV === 'test' }),
    PrismaModule,
    MailModule,
    AuthModule,
    UsersModule,
    CommunityModule,
    ConsultationsModule,
    NotificationsModule,
    MessagingModule,
    SubscriptionsModule,
    ModerationModule,
    AiEngineModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: rate-limit → authenticate → authorise (role → expert → premium).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: VerifiedExpertGuard },
    { provide: APP_GUARD, useClass: PremiumGuard },
  ],
})
export class AppModule {}
