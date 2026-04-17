import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ANALYTICS_REPOSITORY } from './domain/ports/analytics-repository.port';
import { PrismaAnalyticsAdapter } from './infrastructure/adapters/prisma-analytics.adapter';
import { GetSpendingHandler } from './application/queries/get-spending/get-spending.handler';
import { AnalyticsController } from './infrastructure/http/analytics.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [CqrsModule, AuthModule],
  controllers: [AnalyticsController],
  providers: [
    {
      provide: ANALYTICS_REPOSITORY,
      useClass: PrismaAnalyticsAdapter,
    },
    GetSpendingHandler,
  ],
})
export class AnalyticsModule {}
