import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { FetchDteEmailsCommand } from './fetch-dte-emails.command';
import { EmailReaderPort, EMAIL_READER } from '../../../domain/ports/email-reader.port';
import { FileStoragePort, FILE_STORAGE } from '../../../domain/ports/file-storage.port';
import { DteRepository, DTE_REPOSITORY } from '../../../domain/ports/dte-repository.port';
import { TaxpayerRepository, TAXPAYER_REPOSITORY } from '../../../../../modules/taxpayer/domain/ports/taxpayer-repository.port';
import { LlmClassifierPort, LLM_CLASSIFIER } from '../../../../llm/domain/ports/llm-classifier.port';
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
    @Inject(TAXPAYER_REPOSITORY) private readonly taxpayerRepository: TaxpayerRepository,
    @Inject(LLM_CLASSIFIER) private readonly llmClassifier: LlmClassifierPort,
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

      if (!dteDoc) {
        this.logService.log(
          `Could not parse DTE document from email: ${email.subject}. Skipping upload.`,
          'dte',
        );
        continue;
      }

      const existing = await this.dteRepository.findByGenerationCode(dteDoc.codigoGeneracion);
      if (existing) {
        if (existing.itemsCategory && existing.itemsCategory.length > 0) {
          this.logService.log(
            `DTE ${dteDoc.codigoGeneracion} already exists and is classified. Skipping.`,
            'dte',
          );
        } else {
          this.logService.log(
            `DTE ${dteDoc.codigoGeneracion} already exists but not classified. Classifying...`,
            'dte',
          );
          await this.classifyDte(dteDoc.codigoGeneracion, rawJson).catch((err) =>
            this.logService.log(
              `Classification failed for ${dteDoc.codigoGeneracion}: ${err.message}`,
              'dte',
            ),
          );
        }
        continue;
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

      if (rawJson?.emisor?.nrc) {
        await this.taxpayerRepository.upsert(rawJson.emisor.nrc, {
          nit: rawJson.emisor.nit,
          nombre: rawJson.emisor.nombre || '',
          nombreComercial: rawJson.emisor.nombreComercial,
          codActividad: rawJson.emisor.codActividad,
          descActividad: rawJson.emisor.descActividad,
          rawJson: rawJson.emisor,
        });
      }
      if (rawJson?.receptor?.nrc) {
        await this.taxpayerRepository.upsert(rawJson.receptor.nrc, {
          nit: rawJson.receptor.nit,
          nombre: rawJson.receptor.nombre || '',
          nombreComercial: rawJson.receptor.nombreComercial,
          codActividad: rawJson.receptor.codActividad,
          descActividad: rawJson.receptor.descActividad,
          rawJson: rawJson.receptor,
        });
      }
      await this.dteRepository.save(dteDoc, type, lastPdfUrl, rawJson);
      this.logService.log(`Saved DTE to DB: ${dteDoc.codigoGeneracion}`, 'dte');

      // Classify — non-blocking, errors logged but do not fail the sync
      await this.classifyDte(dteDoc.codigoGeneracion, rawJson).catch((err) =>
        this.logService.log(
          `Classification failed for ${dteDoc.codigoGeneracion}: ${err.message}`,
          'dte',
        ),
      );

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

  private async classifyDte(generationCode: string, rawJson: any): Promise<void> {
    // Extract item descriptions from cuerpoDocumento
    const cuerpo: any[] = Array.isArray(rawJson?.cuerpoDocumento) ? rawJson.cuerpoDocumento : [];
    const descriptions: string[] = cuerpo
      .map((item: any) => item?.descripcion)
      .filter((d): d is string => typeof d === 'string' && d.trim().length > 0);

    let itemsCategory: string[] = [];
    if (descriptions.length > 0) {
      itemsCategory = await this.llmClassifier.classifyItems(descriptions);
    }

    await this.dteRepository.updateClassification(generationCode, itemsCategory);
    this.logService.log(
      `Classified DTE ${generationCode}: ${itemsCategory.length} item categories`,
      'dte',
    );
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
