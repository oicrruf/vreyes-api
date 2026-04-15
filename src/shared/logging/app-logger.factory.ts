import { Injectable } from '@nestjs/common';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

export class AppLogger {
  constructor(private readonly logger: winston.Logger) {}

  log(message: string, meta?: Record<string, any>): void {
    this.logger.info(message, meta);
  }

  error(message: string, meta?: Record<string, any>): void {
    this.logger.error(message, meta);
  }

  warn(message: string, meta?: Record<string, any>): void {
    this.logger.warn(message, meta);
  }

  debug(message: string, meta?: Record<string, any>): void {
    this.logger.debug(message, meta);
  }
}

@Injectable()
export class AppLoggerFactory {
  private readonly loggers = new Map<string, AppLogger>();

  create(userId: string, module: string): AppLogger {
    const key = `${userId}:${module}`;
    if (this.loggers.has(key)) return this.loggers.get(key)!;

    const logFormat = winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      return `[${timestamp}] [${level.toUpperCase()}] [${module}] ${message}${metaStr}`;
    });

    const logger = winston.createLogger({
      level: process.env.LOG_LEVEL ?? 'info',
      format: winston.format.combine(winston.format.timestamp(), logFormat),
      transports: [
        new DailyRotateFile({
          dirname: `logs/${userId}/${module}`,
          filename: '%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxFiles: '90d',
        }),
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp(),
            logFormat,
          ),
        }),
      ],
    });

    const appLogger = new AppLogger(logger);
    this.loggers.set(key, appLogger);
    return appLogger;
  }
}
