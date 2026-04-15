import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { FetchDteEmailsCommand } from './fetch-dte-emails.command';
import { EmailReaderPort, EMAIL_READER } from '../../../domain/ports/email-reader.port';
import { FileStoragePort, FILE_STORAGE } from '../../../domain/ports/file-storage.port';
import { DteRepository, DTE_REPOSITORY } from '../../../domain/ports/dte-repository.port';
import { DateRange } from '../../../domain/value-objects/date-range.vo';
import { Nrc } from '../../../domain/value-objects/nrc.vo';
import { DteDocument } from '../../../domain/entities/dte-document.entity';
import { DteFetchedEvent } from '../../../domain/events/dte-fetched.event';
import { LogService } from '../../../../../shared/logging/log.service';

export interface FetchDteEmailsResult {
  processed: number;
  downloaded: number;
  files: Array<{ id: number; json?: string; pdf?: string }>;
}

@CommandHandler(FetchDteEmailsCommand)
export class FetchDteEmailsHandler
  implements ICommandHandler<FetchDteEmailsCommand, FetchDteEmailsResult>
{
  constructor(
    @Inject(EMAIL_READER) private readonly emailReader: EmailReaderPort,
    @Inject(FILE_STORAGE) private readonly fileStorage: FileStoragePort,
    @Inject(DTE_REPOSITORY) private readonly dteRepository: DteRepository,
    private readonly eventBus: EventBus,
    private readonly logService: LogService,
  ) {}

  async execute(command: FetchDteEmailsCommand): Promise<FetchDteEmailsResult> {
    const { type, year, month } = command;

    const targetNrcStr = process.env.RECEPTOR_NRC;
    if (!targetNrcStr) {
      throw new Error('Configuration error: RECEPTOR_NRC environment variable is not set');
    }

    const targetNrc = new Nrc(targetNrcStr);
    const dateRange = DateRange.forMonth(year, month);

    this.logService.log(
      `Fetching emails for Year=${year ?? 'current'}, Month=${month ?? 'current'}, Type=${type}`,
      'dte',
    );

    const emails = await this.emailReader.readEmails(dateRange);
    this.logService.log(`Found ${emails.length} emails in the specified date range`, 'dte');

    const now = new Date();
    const yearStr = (year ?? now.getFullYear()).toString();
    const monthStr = (month ?? now.getMonth() + 1).toString().padStart(2, '0');
    const folderLabel = type === 'purchase' ? 'compras' : 'ventas';
    const driveFolderPath = `dte/${yearStr}/${monthStr}/${folderLabel}`;

    const downloadedFiles: Array<{ id: number; json?: string; pdf?: string }> = [];

    for (const email of emails) {
      if (!email.attachments?.length) continue;

      let jsonAttachment: any = null;

      for (const attachment of email.attachments) {
        if (this.isJsonAttachment(attachment)) {
          const jsonData = this.parseJson(attachment);
          if (jsonData && targetNrc.matchesDteJson(jsonData)) {
            jsonAttachment = attachment;
            break;
          }
        }
      }

      if (!jsonAttachment) continue;

      const rawJson = this.parseJson(jsonAttachment);
      const dteDoc = rawJson ? DteDocument.fromJson(rawJson) : null;

      if (dteDoc) {
        const existing = await this.dteRepository.findByGenerationCode(dteDoc.codigoGeneracion);
        if (existing) {
          this.logService.log(
            `DTE ${dteDoc.codigoGeneracion} already exists in DB. Skipping...`,
            'dte',
          );
          continue;
        }
      }

      const jsonFilename = jsonAttachment.filename || `data_${email.uid}.json`;

      this.logService.log(`Uploading JSON from email: ${email.subject}`, 'dte');
      const jsonDriveId = await this.fileStorage.upload(
        jsonFilename,
        jsonAttachment.content,
        jsonAttachment.contentType || 'application/json',
        driveFolderPath,
      );
      if (jsonDriveId) this.logService.log(`Uploaded JSON to Drive: ${jsonDriveId}`, 'dte');

      const pdfFilenames: string[] = [];
      let lastPdfUrl: string | undefined;

      for (const attachment of email.attachments) {
        if (attachment.filename?.toLowerCase().endsWith('.pdf')) {
          const pdfDriveId = await this.fileStorage.upload(
            attachment.filename,
            attachment.content,
            'application/pdf',
            driveFolderPath,
          );
          if (pdfDriveId) {
            pdfFilenames.push(attachment.filename);
            lastPdfUrl = `https://drive.google.com/file/d/${pdfDriveId}/view`;
            this.logService.log(`Uploaded PDF to Drive: ${pdfDriveId}`, 'dte');
          }
        }
      }

      if (dteDoc) {
        await this.dteRepository.save(dteDoc, type, lastPdfUrl, rawJson);
        this.logService.log(`Saved DTE to DB: ${dteDoc.codigoGeneracion}`, 'dte');
      }

      if (pdfFilenames.length > 0) {
        pdfFilenames.forEach((pdf) => {
          downloadedFiles.push({ id: email.uid, json: jsonFilename, pdf });
        });
      } else {
        downloadedFiles.push({ id: email.uid, json: jsonFilename });
      }
    }

    this.eventBus.publish(
      new DteFetchedEvent(
        year ?? now.getFullYear(),
        month ?? now.getMonth() + 1,
        downloadedFiles.length,
      ),
    );

    return {
      processed: emails.length,
      downloaded: downloadedFiles.length,
      files: downloadedFiles,
    };
  }

  private isJsonAttachment(attachment: any): boolean {
    return (
      attachment.contentType === 'application/json' ||
      (attachment.filename && attachment.filename.toLowerCase().endsWith('.json'))
    );
  }

  private parseJson(attachment: any): any {
    try {
      return JSON.parse(attachment.content.toString('utf-8').trim());
    } catch {
      return null;
    }
  }
}
