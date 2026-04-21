import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthModule } from '../auth/auth.module';
import { LlmModule } from '../llm/llm.module';
import { TaxpayerModule } from '../taxpayer/taxpayer.module';

import { EMAIL_READER } from './domain/ports/email-reader.port';
import { FILE_STORAGE } from './domain/ports/file-storage.port';
import { EMAIL_SENDER } from './domain/ports/email-sender.port';
import { DTE_REPOSITORY } from './domain/ports/dte-repository.port';

import { GmailAdapter } from './infrastructure/adapters/gmail.adapter';
import { GoogleDriveAdapter } from './infrastructure/adapters/google-drive.adapter';
import { NodemailerAdapter } from './infrastructure/adapters/nodemailer.adapter';
import { PrismaDteAdapter } from './infrastructure/adapters/prisma-dte.adapter';

import { FetchDteEmailsHandler } from './application/commands/fetch-dte-emails/fetch-dte-emails.handler';
import { SendDteAttachmentsHandler } from './application/commands/send-dte-attachments/send-dte-attachments.handler';
import { GetDteFilesHandler } from './application/queries/get-dte-files/get-dte-files.handler';
import { GetDteDetailHandler } from './application/queries/get-dte-detail/get-dte-detail.handler';
import { UploadSaleDteHandler } from './application/commands/upload-sale-dte/upload-sale-dte.handler';
import { ExtractDteFromFilesHandler } from './application/commands/extract-dte-from-files/extract-dte-from-files.handler';

import { DteController } from './infrastructure/http/dte.controller';
import { DteScheduler } from './infrastructure/scheduled/dte.scheduler';
import { LogService } from '../../shared/logging/log.service';
import { PdfToImageService } from '../../shared/pdf/pdf-to-image.service';

@Module({
  imports: [CqrsModule, AuthModule, LlmModule, TaxpayerModule],
  controllers: [DteController],
  providers: [
    // Ports → Adapters
    { provide: EMAIL_READER, useClass: GmailAdapter },
    { provide: FILE_STORAGE, useClass: GoogleDriveAdapter },
    { provide: EMAIL_SENDER, useClass: NodemailerAdapter },
    { provide: DTE_REPOSITORY, useClass: PrismaDteAdapter },

    // CQRS Handlers
    FetchDteEmailsHandler,
    SendDteAttachmentsHandler,
    GetDteFilesHandler,
    GetDteDetailHandler,
    UploadSaleDteHandler,
    ExtractDteFromFilesHandler,

    // Scheduler
    DteScheduler,

    // Shared
    LogService,
    PdfToImageService,
  ],
})
export class DteModule {}
