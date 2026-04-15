import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CommandBus } from '@nestjs/cqrs';
import { FetchDteEmailsCommand } from '../../application/commands/fetch-dte-emails/fetch-dte-emails.command';
import { SendDteAttachmentsCommand } from '../../application/commands/send-dte-attachments/send-dte-attachments.command';

const TIMEZONE = 'America/El_Salvador';

@Injectable()
export class DteScheduler {
  private readonly logger = new Logger(DteScheduler.name);

  constructor(private readonly commandBus: CommandBus) {}

  /** Runs at 11:59 PM every day — fetches and uploads DTE attachments to Drive */
  @Cron('59 23 * * *', { timeZone: TIMEZONE })
  async fetchDteEmails(): Promise<void> {
    this.logger.log('Running daily DTE email fetch...');
    try {
      const result = await this.commandBus.execute(new FetchDteEmailsCommand('purchase'));
      this.logger.log(
        `Daily fetch complete: ${result.processed} emails processed, ${result.downloaded} files downloaded`,
      );
    } catch (err: any) {
      this.logger.error(`Daily DTE fetch failed: ${err.message}`);
    }
  }

  /** Runs at 7:00 AM on the 1st of every month — sends DTE files via email */
  @Cron('0 7 1 * *', { timeZone: TIMEZONE })
  async sendDteAttachments(): Promise<void> {
    this.logger.log('Running monthly DTE email send...');
    try {
      const result = await this.commandBus.execute(new SendDteAttachmentsCommand());
      this.logger.log(
        `Monthly send complete: ${result.sentFiles.length} files sent`,
      );
    } catch (err: any) {
      this.logger.error(`Monthly DTE send failed: ${err.message}`);
    }
  }
}
