import { Injectable } from '@nestjs/common';
import fs from 'fs';
import path from 'path';

@Injectable()
export class LogService {
  log(
    message: any,
    module = 'app',
    type: 'info' | 'error' | 'debug' = 'info',
  ): void {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const day = now.getDate().toString().padStart(2, '0');

      const logDir = path.join('logs', module, year.toString(), month);
      fs.mkdirSync(logDir, { recursive: true });

      const logFile = path.join(logDir, `${year}-${month}-${day}.log`);
      const timestamp = now.toISOString();

      const logMessage =
        typeof message === 'string'
          ? `[${timestamp}] [${type.toUpperCase()}] [${module}] ${message}\n`
          : `[${timestamp}] [${type.toUpperCase()}] [${module}] ${JSON.stringify(message, null, 2)}\n`;

      fs.appendFileSync(logFile, logMessage);
    } catch (err) {
      console.error('Error writing to log file:', err);
      console.log(message);
    }
  }

  error(message: any, module = 'app'): void {
    this.log(message, module, 'error');
  }
}
