import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DteModule } from './modules/dte/dte.module';
import { AuthModule } from './modules/auth/auth.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { LoggingModule } from './shared/logging/logging.module';
import { DatabaseModule } from './shared/database/database.module';

@Module({
  imports: [
    LoggingModule,
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    DteModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
