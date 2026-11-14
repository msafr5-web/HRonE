import { Module } from '@nestjs/common';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AdminController, ReportsController } from './moderation.controller';
import { ModerationService } from './moderation.service';

@Module({ imports: [SubscriptionsModule], controllers: [ReportsController, AdminController], providers: [ModerationService] })
export class ModerationModule {}
