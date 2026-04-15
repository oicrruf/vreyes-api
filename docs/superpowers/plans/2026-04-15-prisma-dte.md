# Prisma + PostgreSQL Integration for DTE Module — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Prisma with Supabase PostgreSQL to persist DTE documents with full support for upsert, lookup, and type-filtered queries.

**Architecture:** `DatabaseModule` (global) provides `PrismaService`. `DteModule` registers `PrismaDteAdapter` as the implementation of the `DteRepository` port. `FetchDteEmailsHandler` uses the port to save each processed DTE.

**Tech Stack:** NestJS, Prisma 5, PostgreSQL (Supabase), CQRS, Hexagonal Architecture

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `prisma/schema.prisma` | Prisma schema with `Dte` model and `DteType` enum |
| Create | `src/shared/database/prisma.service.ts` | NestJS provider extending `PrismaClient` |
| Create | `src/shared/database/database.module.ts` | Global NestJS module exporting `PrismaService` |
| Create | `src/modules/dte/domain/ports/dte-repository.port.ts` | Repository interface (port) |
| Create | `src/modules/dte/infrastructure/adapters/prisma-dte.adapter.ts` | Prisma implementation of the port |
| Modify | `src/app.module.ts` | Import `DatabaseModule` |
| Modify | `src/modules/dte/dte.module.ts` | Register `DTE_REPOSITORY` → `PrismaDteAdapter` |
| Modify | `src/modules/dte/application/commands/fetch-dte-emails/fetch-dte-emails.command.ts` | Add `type: 'purchase' \| 'sale'` field |
| Modify | `src/modules/dte/infrastructure/http/dto/fetch-dte.dto.ts` | Add `type` query param |
| Modify | `src/modules/dte/infrastructure/http/dte.controller.ts` | Pass `type` to command |
| Modify | `src/modules/dte/application/commands/fetch-dte-emails/fetch-dte-emails.handler.ts` | Inject `DteRepository`, call `save` after upload |

---

### Task 1: Install Prisma and initialize schema

**Files:**
- Create: `prisma/schema.prisma`

- [ ] **Step 1: Install dependencies**

```bash
npm install prisma --save-dev
npm install @prisma/client
```

- [ ] **Step 2: Initialize Prisma**

```bash
npx prisma init --datasource-provider postgresql
```

This creates `prisma/schema.prisma` and adds `DATABASE_URL` to `.env`. We will override the env var name in the next step.

- [ ] **Step 3: Replace contents of `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("SUPABASE_DATABASE_URI")
}

enum DteType {
  purchase
  sale
}

model Dte {
  generationCode String   @id @map("generation_code")
  type           DteType
  issueDate      String   @map("issue_date")
  receiverNrc    String   @map("receiver_nrc")
  issuerNrc      String   @map("issuer_nrc")
  issuerName     String   @map("issuer_name")
  exemptTotal    Float    @map("exempt_total")
  taxableTotal   Float    @map("taxable_total")
  amountDue      Float    @map("amount_due")
  taxValue       Float    @map("tax_value")
  pdfUrl         String?  @map("pdf_url")
  rawJson        Json     @map("raw_json")
  createdAt      DateTime @default(now()) @map("created_at")

  @@map("dte")
}
```

- [ ] **Step 4: Delete the `DATABASE_URL` line added to `.env` by `prisma init`**

`prisma init` adds `DATABASE_URL="..."` to `.env`. Remove that line — the project already uses `SUPABASE_DATABASE_URI`.

- [ ] **Step 5: Run migration to create the table**

```bash
npx prisma migrate dev --name init_dte
```

Expected output: `Your database is now in sync with your schema.`

- [ ] **Step 6: Generate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 7: Commit**

```bash
git add prisma/ package.json package-lock.json
git commit -m "feat: add Prisma schema for DTE module"
```

---

### Task 2: Create PrismaService and DatabaseModule

**Files:**
- Create: `src/shared/database/prisma.service.ts`
- Create: `src/shared/database/database.module.ts`

- [ ] **Step 1: Create `src/shared/database/prisma.service.ts`**

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

- [ ] **Step 2: Create `src/shared/database/database.module.ts`**

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
```

- [ ] **Step 3: Import `DatabaseModule` in `src/app.module.ts`**

Replace contents:

```typescript
import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DteModule } from './modules/dte/dte.module';
import { DatabaseModule } from './shared/database/database.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DatabaseModule,
    DteModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 4: Commit**

```bash
git add src/shared/database/ src/app.module.ts
git commit -m "feat: add PrismaService and DatabaseModule"
```

---

### Task 3: Create DteRepository port

**Files:**
- Create: `src/modules/dte/domain/ports/dte-repository.port.ts`

- [ ] **Step 1: Create the port file**

```typescript
import { DteDocument } from '../entities/dte-document.entity';

export const DTE_REPOSITORY = 'DTE_REPOSITORY';

export type DteType = 'purchase' | 'sale';

export interface DteRepository {
  save(dte: DteDocument, type: DteType, pdfUrl?: string, rawJson?: object): Promise<void>;
  findByGenerationCode(code: string): Promise<DteDocument | null>;
  findAll(type?: DteType): Promise<DteDocument[]>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/dte/domain/ports/dte-repository.port.ts
git commit -m "feat: add DteRepository port"
```

---

### Task 4: Create PrismaDteAdapter

**Files:**
- Create: `src/modules/dte/infrastructure/adapters/prisma-dte.adapter.ts`

- [ ] **Step 1: Create the adapter**

```typescript
import { Injectable } from '@nestjs/common';
import { DteType as PrismaDteType } from '@prisma/client';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { DteRepository, DteType } from '../../domain/ports/dte-repository.port';
import { DteDocument } from '../../domain/entities/dte-document.entity';

@Injectable()
export class PrismaDteAdapter implements DteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(dte: DteDocument, type: DteType, pdfUrl?: string, rawJson?: object): Promise<void> {
    await this.prisma.dte.upsert({
      where: { generationCode: dte.codigoGeneracion },
      create: {
        generationCode: dte.codigoGeneracion,
        type: this.toPrismaType(type),
        issueDate: dte.fechaEmision,
        receiverNrc: dte.receptorNrc,
        issuerNrc: dte.emisorNrc,
        issuerName: dte.emisorNombre,
        exemptTotal: dte.totalExenta,
        taxableTotal: dte.totalGravada,
        amountDue: dte.totalPagar,
        taxValue: dte.tributosValor,
        pdfUrl: pdfUrl ?? null,
        rawJson: rawJson ?? {},
      },
      update: {
        pdfUrl: pdfUrl ?? undefined,
      },
    });
  }

  async findByGenerationCode(code: string): Promise<DteDocument | null> {
    const record = await this.prisma.dte.findUnique({
      where: { generationCode: code },
    });
    if (!record) return null;
    return new DteDocument(
      record.generationCode,
      record.issueDate,
      record.receiverNrc,
      record.issuerNrc,
      record.issuerName,
      record.exemptTotal,
      record.taxableTotal,
      record.amountDue,
      record.taxValue,
    );
  }

  async findAll(type?: DteType): Promise<DteDocument[]> {
    const records = await this.prisma.dte.findMany({
      where: type ? { type: this.toPrismaType(type) } : undefined,
    });
    return records.map(
      (r) =>
        new DteDocument(
          r.generationCode,
          r.issueDate,
          r.receiverNrc,
          r.issuerNrc,
          r.issuerName,
          r.exemptTotal,
          r.taxableTotal,
          r.amountDue,
          r.taxValue,
        ),
    );
  }

  private toPrismaType(type: DteType): PrismaDteType {
    return type === 'purchase' ? PrismaDteType.purchase : PrismaDteType.sale;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/dte/infrastructure/adapters/prisma-dte.adapter.ts
git commit -m "feat: add PrismaDteAdapter implementing DteRepository port"
```

---

### Task 5: Register adapter in DteModule

**Files:**
- Modify: `src/modules/dte/dte.module.ts`

- [ ] **Step 1: Update `src/modules/dte/dte.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

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

import { DteController } from './infrastructure/http/dte.controller';
import { DteScheduler } from './infrastructure/scheduled/dte.scheduler';
import { LogService } from '../../shared/logging/log.service';

@Module({
  imports: [CqrsModule],
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

    // Scheduler
    DteScheduler,

    // Shared
    LogService,
  ],
})
export class DteModule {}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/dte/dte.module.ts
git commit -m "feat: register PrismaDteAdapter in DteModule"
```

---

### Task 6: Add `type` to command, DTO, and controller

**Files:**
- Modify: `src/modules/dte/application/commands/fetch-dte-emails/fetch-dte-emails.command.ts`
- Modify: `src/modules/dte/infrastructure/http/dto/fetch-dte.dto.ts`
- Modify: `src/modules/dte/infrastructure/http/dte.controller.ts`

- [ ] **Step 1: Update `fetch-dte-emails.command.ts`**

```typescript
import { DteType } from '../../domain/ports/dte-repository.port';

export class FetchDteEmailsCommand {
  constructor(
    public readonly type: DteType,
    public readonly year?: number,
    public readonly month?: number,
  ) {}
}
```

- [ ] **Step 2: Update `fetch-dte.dto.ts`**

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FetchDteDto {
  @ApiProperty({ description: "Tipo de DTE a procesar: 'purchase' o 'sale'.", enum: ['purchase', 'sale'] })
  type: 'purchase' | 'sale';

  @ApiPropertyOptional({ description: 'Año a consultar (ej. 2026). Si se omite, usa el año actual.' })
  year?: number;

  @ApiPropertyOptional({ description: 'Mes a consultar (1-12). Si se omite, usa el mes actual.' })
  month?: number;
}
```

- [ ] **Step 3: Update `fetchDteEmails` in `dte.controller.ts`**

Replace the `fetchDteEmails` method:

```typescript
@Post('dte')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Obtiene correos del mes especificado y descarga adjuntos (DTE).' })
@ApiResponse({ status: 200, description: 'Correos procesados con éxito.' })
@ApiResponse({ status: 400, description: 'Parámetros inválidos.' })
@ApiResponse({ status: 500, description: 'Error interno o de configuración.' })
async fetchDteEmails(@Query() query: FetchDteDto) {
  if (!query.type || !['purchase', 'sale'].includes(query.type)) {
    throw new BadRequestException("El parámetro 'type' debe ser 'purchase' o 'sale'.");
  }

  const year = query.year ? Number(query.year) : undefined;
  const month = query.month ? Number(query.month) : undefined;

  if (month !== undefined && (month < 1 || month > 12)) {
    throw new BadRequestException('Month must be between 1 and 12');
  }

  try {
    const result = await this.commandBus.execute(
      new FetchDteEmailsCommand(query.type, year, month),
    );
    return {
      success: true,
      message: `Processed ${result.processed} emails. Downloaded ${result.downloaded} files.`,
      detail: result,
    };
  } catch (err: any) {
    if (err.message?.includes('RECEPTOR_NRC')) {
      throw new InternalServerErrorException(err.message);
    }
    throw new InternalServerErrorException('Internal server error');
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/modules/dte/application/commands/fetch-dte-emails/fetch-dte-emails.command.ts
git add src/modules/dte/infrastructure/http/dto/fetch-dte.dto.ts
git add src/modules/dte/infrastructure/http/dte.controller.ts
git commit -m "feat: add type param to FetchDteEmailsCommand and controller"
```

---

### Task 7: Integrate DteRepository into FetchDteEmailsHandler

**Files:**
- Modify: `src/modules/dte/application/commands/fetch-dte-emails/fetch-dte-emails.handler.ts`

- [ ] **Step 1: Update the handler**

Replace the full file contents:

```typescript
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

      const jsonFilename = jsonAttachment.filename || `data_${email.uid}.json`;
      const rawJson = this.parseJson(jsonAttachment);
      const dteDoc = rawJson ? DteDocument.fromJson(rawJson) : null;

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
```

- [ ] **Step 2: Build to verify no TypeScript errors**

```bash
npm run build
```

Expected: build completes with no errors in `dist/`.

- [ ] **Step 3: Commit**

```bash
git add src/modules/dte/application/commands/fetch-dte-emails/fetch-dte-emails.handler.ts
git commit -m "feat: integrate DteRepository into FetchDteEmailsHandler"
```
