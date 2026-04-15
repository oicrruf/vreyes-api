import { Global, Module } from '@nestjs/common';
import { AppLoggerFactory } from './app-logger.factory';

@Global()
@Module({
  providers: [AppLoggerFactory],
  exports: [AppLoggerFactory],
})
export class LoggingModule {}
