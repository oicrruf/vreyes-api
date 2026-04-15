import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { Parser } from 'json2csv';
import { SendDteAttachmentsCommand } from './send-dte-attachments.command';
import { FileStoragePort, FILE_STORAGE } from '../../../domain/ports/file-storage.port';
import { EmailSenderPort, EMAIL_SENDER } from '../../../domain/ports/email-sender.port';
import { DteDocument } from '../../../domain/entities/dte-document.entity';
import { DteSentEvent } from '../../../domain/events/dte-sent.event';
import { AppLoggerFactory, AppLogger } from '../../../../../shared/logging/app-logger.factory';

export interface SendDteAttachmentsResult {
  sentFiles: string[];
  deletedJsonFiles: string[];
  messageId?: string;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

@CommandHandler(SendDteAttachmentsCommand)
export class SendDteAttachmentsHandler
  implements ICommandHandler<SendDteAttachmentsCommand, SendDteAttachmentsResult>
{
  private readonly logger: AppLogger;

  constructor(
    @Inject(FILE_STORAGE) private readonly fileStorage: FileStoragePort,
    @Inject(EMAIL_SENDER) private readonly emailSender: EmailSenderPort,
    private readonly eventBus: EventBus,
    private readonly loggerFactory: AppLoggerFactory,
  ) {
    // TODO: replace 'system' with real userId from auth context
    this.logger = this.loggerFactory.create(process.env.DEFAULT_USER_ID ?? 'system', 'dte');
  }

  async execute(command: SendDteAttachmentsCommand): Promise<SendDteAttachmentsResult> {
    const recipients = (process.env.RECIPIENT_EMAIL ?? '')
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);

    if (recipients.length === 0) {
      throw new Error('No recipients found in RECIPIENT_EMAIL environment variable');
    }

    const { targetYear, targetMonth } = this.resolveTargetPeriod(command.year, command.month);
    const monthName = MONTH_NAMES[parseInt(targetMonth) - 1];
    const driveFolderPath = `dte/${targetYear}/${targetMonth}/compras`;

    this.logger.log(`Sending DTE for ${targetYear}-${targetMonth} to ${recipients.join(', ')}`);

    const driveFiles = await this.fileStorage.list(driveFolderPath);

    if (!driveFiles?.length) {
      throw new Error(
        `No files found in Google Drive for ${targetYear}-${targetMonth} at ${driveFolderPath}`,
      );
    }

    const jsonFiles = driveFiles.filter(
      (f) => f.name?.toLowerCase().endsWith('.json') || f.mimeType === 'application/json',
    );
    const pdfFiles = driveFiles.filter(
      (f) => f.name?.toLowerCase().endsWith('.pdf') || f.mimeType === 'application/pdf',
    );

    if (pdfFiles.length === 0) {
      throw new Error('No PDF files found to send in Drive');
    }

    this.logger.log(`Found ${jsonFiles.length} JSON and ${pdfFiles.length} PDF files in Drive`);

    const targetNrc = process.env.RECEPTOR_NRC ?? '2594881';
    const csvRows = await this.buildCsvRows(jsonFiles, targetNrc);
    const buffersToAttach = await this.buildAttachments(
      csvRows,
      pdfFiles,
      targetYear,
      targetMonth,
      monthName,
    );

    const subject =
      command.subject ?? `${targetYear}-${targetMonth}: CCF de Víctor M. Reyes`;
    const text =
      command.message ??
      `Adjunto envío los Comprobantes de Crédito Fiscal correspondientes al mes de ${monthName}.`;

    const result = await this.emailSender.send(recipients, buffersToAttach, subject, text);

    if (!result.success) {
      throw new Error(result.error ?? 'Failed to send email');
    }

    const deletedJsonFiles = await this.deleteJsonFiles(jsonFiles);

    this.eventBus.publish(
      new DteSentEvent(
        parseInt(targetYear),
        parseInt(targetMonth),
        recipients,
        buffersToAttach.length,
      ),
    );

    return {
      sentFiles: buffersToAttach.map((f) => f.filename),
      deletedJsonFiles,
      messageId: result.messageId,
    };
  }

  private resolveTargetPeriod(
    year?: number,
    month?: number,
  ): { targetYear: string; targetMonth: string } {
    if (year && month) {
      return {
        targetYear: year.toString(),
        targetMonth: month.toString().padStart(2, '0'),
      };
    }
    const prev = new Date();
    prev.setMonth(prev.getMonth() - 1);
    return {
      targetYear: prev.getFullYear().toString(),
      targetMonth: (prev.getMonth() + 1).toString().padStart(2, '0'),
    };
  }

  private async buildCsvRows(jsonFiles: any[], targetNrc: string): Promise<any[]> {
    const rows = [];
    for (const file of jsonFiles) {
      try {
        const buffer = await this.fileStorage.download(file.id);
        if (!buffer) continue;
        const jsonData = JSON.parse(buffer.toString('utf8'));
        if (jsonData?.receptor?.nrc !== targetNrc) continue;
        const doc = DteDocument.fromJson(jsonData);
        if (!doc) continue;
        rows.push({
          Column1: doc.formattedDate,
          Column2: 1,
          Column3: 3,
          Column4: doc.codigoGeneracion,
          Column5: doc.emisorNrc,
          Column6: doc.emisorNombre,
          Column7: doc.totalExenta,
          Column8: 0,
          Column9: 0,
          Column10: doc.totalGravada,
          Column11: 0,
          Column12: 0,
          Column13: 0,
          Column14: doc.tributosValor,
          Column15: doc.totalPagar,
          Column16: '',
          Column17: 1,
          Column18: 2,
          Column19: 4,
          Column20: 2,
          Column21: 3,
        });
      } catch (err) {
        this.logger.error(`Error processing Drive JSON file ${file.name}: ${err}`);
      }
    }
    return rows;
  }

  private async buildAttachments(
    csvRows: any[],
    pdfFiles: any[],
    targetYear: string,
    targetMonth: string,
    monthName: string,
  ): Promise<Array<{ filename: string; content: Buffer }>> {
    const attachments: Array<{ filename: string; content: Buffer }> = [];

    const csvParser = new Parser({
      fields: [
        'Column1', 'Column2', 'Column3', 'Column4', 'Column5', 'Column6', 'Column7',
        'Column8', 'Column9', 'Column10', 'Column11', 'Column12', 'Column13', 'Column14',
        'Column15', 'Column16', 'Column17', 'Column18', 'Column19', 'Column20', 'Column21',
      ],
    });
    const csvContent = csvParser.parse(csvRows);
    attachments.push({
      filename: `COMPRAS-${monthName.toUpperCase()}-${targetYear}.csv`,
      content: Buffer.from(csvContent, 'utf-8'),
    });

    for (const file of pdfFiles) {
      const buffer = await this.fileStorage.download(file.id);
      if (buffer) {
        attachments.push({ filename: file.name, content: buffer });
      }
    }

    return attachments;
  }

  private async deleteJsonFiles(jsonFiles: any[]): Promise<string[]> {
    const deleted: string[] = [];
    for (const file of jsonFiles) {
      try {
        await this.fileStorage.delete(file.id);
        deleted.push(file.name);
        this.logger.log(`Deleted JSON file from Drive: ${file.name}`);
      } catch (err) {
        this.logger.error(`Error deleting Drive JSON ${file.name}: ${err}`);
      }
    }
    return deleted;
  }
}
