# Taxpayer & Activity Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract issuer/receiver data from DTE records into normalized `taxpayer` and `activity` tables, relate `dte` via NRC foreign keys, and remove `issuer_name`, `receiver_name`, `issuer_activity` from the `dte` table.

**Architecture:** New `taxpayer` module (hexagonal, port + Prisma adapter) upserts taxpayer/activity records during sync before saving each DTE. Prisma FK relations enforce referential integrity. A single multi-step migration handles table creation, data backfill, FK wiring, and column cleanup safely.

**Tech Stack:** NestJS CQRS, Prisma 7, PostgreSQL (Supabase), TypeScript.

---

## File Map

| Action | File |
|--------|------|
| Modify | `prisma/schema.prisma` |
| Create | `src/modules/taxpayer/domain/ports/taxpayer-repository.port.ts` |
| Create | `src/modules/taxpayer/infrastructure/adapters/prisma-taxpayer.adapter.ts` |
| Create | `src/modules/taxpayer/taxpayer.module.ts` |
| Modify | `src/modules/dte/domain/ports/dte-repository.port.ts` |
| Modify | `src/modules/dte/domain/entities/dte-document.entity.ts` |
| Modify | `src/modules/dte/infrastructure/adapters/prisma-dte.adapter.ts` |
| Modify | `src/modules/dte/application/commands/fetch-dte-emails/fetch-dte-emails.handler.ts` |
| Modify | `src/modules/dte/application/commands/send-dte-attachments/send-dte-attachments.handler.ts` |
| Modify | `src/modules/dte/application/queries/get-dte-files/get-dte-files.handler.ts` |
| Modify | `src/modules/dte/dte.module.ts` |
| Create | `prisma/migrations/<timestamp>_add_taxpayer_catalog/migration.sql` |

---

## Task 1: Update Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Replace schema with updated version**

Replace the entire `prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  // NO url field — Prisma 7 uses prisma.config.ts
}

enum DteType {
  purchase
  sale
}

model Activity {
  codActividad  String     @id @map("cod_actividad")
  descActividad String     @map("desc_actividad")
  taxpayers     Taxpayer[]

  @@map("activity")
}

model Taxpayer {
  id              String    @id @default(uuid())
  nrc             String?   @unique
  nit             String?
  nombre          String
  nombreComercial String?   @map("nombre_comercial")
  codActividad    String?   @map("cod_actividad")
  rawJson         Json?     @map("raw_json")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  activity     Activity? @relation(fields: [codActividad], references: [codActividad])
  issuedDtes   Dte[]     @relation("issuer")
  receivedDtes Dte[]     @relation("receiver")

  @@map("taxpayer")
}

model Dte {
  generationCode String   @id @map("generation_code")
  type           DteType
  issueDate      String   @map("issue_date")
  receiverNrc    String?  @map("receiver_nrc")
  issuerNrc      String   @map("issuer_nrc")
  exemptTotal    Float    @map("exempt_total")
  taxableTotal   Float    @map("taxable_total")
  amountDue      Float    @map("amount_due")
  taxValue       Float    @map("tax_value")
  pdfUrl         String?  @map("pdf_url")
  itemsCategory  Json?    @map("items_category")
  rawJson        Json     @map("raw_json")
  createdAt      DateTime @default(now()) @map("created_at")

  issuer   Taxpayer  @relation("issuer",   fields: [issuerNrc],   references: [nrc])
  receiver Taxpayer? @relation("receiver", fields: [receiverNrc], references: [nrc])

  @@map("dte")
}

model User {
  id         String         @id @default(uuid())
  email      String         @unique
  name       String?
  avatarUrl  String?        @map("avatar_url")
  createdAt  DateTime       @default(now()) @map("created_at")
  updatedAt  DateTime       @updatedAt @map("updated_at")
  identities UserIdentity[]

  @@map("users")
}

enum IdentityProvider {
  google
  local
  keycloak
}

model UserIdentity {
  id           String           @id @default(uuid())
  userId       String           @map("user_id")
  provider     IdentityProvider
  providerId   String           @map("provider_id")
  passwordHash String?          @map("password_hash")
  lastLogin    DateTime?        @map("last_login")
  user         User             @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerId])
  @@map("user_identities")
}
```

**Do NOT run `prisma migrate` yet — migration is Task 11.**

---

## Task 2: TaxpayerRepository port

**Files:**
- Create: `src/modules/taxpayer/domain/ports/taxpayer-repository.port.ts`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p src/modules/taxpayer/domain/ports
mkdir -p src/modules/taxpayer/infrastructure/adapters
```

- [ ] **Step 2: Create port file**

```typescript
// src/modules/taxpayer/domain/ports/taxpayer-repository.port.ts
export const TAXPAYER_REPOSITORY = 'TAXPAYER_REPOSITORY';

export interface TaxpayerData {
  nit?: string | null;
  nombre: string;
  nombreComercial?: string | null;
  codActividad?: string | null;
  descActividad?: string | null;
  rawJson?: object | null;
}

export interface TaxpayerRepository {
  /**
   * Upserts activity (if codActividad present) and taxpayer in a single transaction.
   * nrc is the unique identifier — duplicate NRCs are never created.
   */
  upsert(nrc: string, data: TaxpayerData): Promise<void>;
}
```

---

## Task 3: PrismaTaxpayerAdapter + TaxpayerModule

**Files:**
- Create: `src/modules/taxpayer/infrastructure/adapters/prisma-taxpayer.adapter.ts`
- Create: `src/modules/taxpayer/taxpayer.module.ts`

- [ ] **Step 1: Create PrismaTaxpayerAdapter**

```typescript
// src/modules/taxpayer/infrastructure/adapters/prisma-taxpayer.adapter.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { TaxpayerRepository, TaxpayerData } from '../../domain/ports/taxpayer-repository.port';

@Injectable()
export class PrismaTaxpayerAdapter implements TaxpayerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(nrc: string, data: TaxpayerData): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      if (data.codActividad && data.descActividad) {
        await tx.activity.upsert({
          where: { codActividad: data.codActividad },
          create: {
            codActividad: data.codActividad,
            descActividad: data.descActividad,
          },
          update: {
            descActividad: data.descActividad,
          },
        });
      }

      await tx.taxpayer.upsert({
        where: { nrc },
        create: {
          nrc,
          nit: data.nit ?? null,
          nombre: data.nombre,
          nombreComercial: data.nombreComercial ?? null,
          codActividad: data.codActividad ?? null,
          rawJson: (data.rawJson as any) ?? null,
        },
        update: {
          nit: data.nit ?? undefined,
          nombre: data.nombre,
          nombreComercial: data.nombreComercial ?? undefined,
          codActividad: data.codActividad ?? undefined,
          rawJson: (data.rawJson as any) ?? undefined,
        },
      });
    });
  }
}
```

- [ ] **Step 2: Create TaxpayerModule**

```typescript
// src/modules/taxpayer/taxpayer.module.ts
import { Module } from '@nestjs/common';
import { PrismaTaxpayerAdapter } from './infrastructure/adapters/prisma-taxpayer.adapter';
import { TAXPAYER_REPOSITORY } from './domain/ports/taxpayer-repository.port';

@Module({
  providers: [
    { provide: TAXPAYER_REPOSITORY, useClass: PrismaTaxpayerAdapter },
  ],
  exports: [TAXPAYER_REPOSITORY],
})
export class TaxpayerModule {}
```

---

## Task 4: Update DteRepository port

**Files:**
- Modify: `src/modules/dte/domain/ports/dte-repository.port.ts`

- [ ] **Step 1: Replace file**

```typescript
// src/modules/dte/domain/ports/dte-repository.port.ts
import { DteDocument } from '../entities/dte-document.entity';

export const DTE_REPOSITORY = 'DTE_REPOSITORY';

export type DteType = 'purchase' | 'sale';

export interface DteRecord {
  generationCode: string;
  type: DteType;
  issueDate: string;
  receiverNrc: string | null;
  issuerNrc: string;
  exemptTotal: number;
  taxableTotal: number;
  amountDue: number;
  taxValue: number;
  pdfUrl: string | null;
  issuerDescActividad: string | null;
  itemsCategory: string[] | null;
  createdAt: Date;
}

export interface DteRepository {
  save(dte: DteDocument, type: DteType, pdfUrl?: string, rawJson?: object): Promise<void>;
  findByGenerationCode(code: string): Promise<DteDocument | null>;
  findAll(type?: DteType): Promise<DteDocument[]>;
  findByPeriod(year: number, month: number, type: DteType): Promise<DteRecord[]>;
  findRawJson(generationCode: string): Promise<object | null>;
  updateClassification(generationCode: string, itemsCategory: string[]): Promise<void>;
}
```

Changes from previous version:
- Removed: `receiverName`, `issuerName`, `issuerActivity`
- Added: `issuerDescActividad: string | null`
- `receiverNrc` changed to `string | null`
- `updateClassification` signature: removed `issuerActivity` param

---

## Task 5: Update DteDocument entity

**Files:**
- Modify: `src/modules/dte/domain/entities/dte-document.entity.ts`

- [ ] **Step 1: Remove nombre fields, keep only what's needed for save + CSV**

`emisorNombre` and `receptorNombre` are no longer stored in DB. `send-dte-attachments.handler.ts` will read `jsonData.emisor.nombre` directly from raw JSON.

Replace the entire file:

```typescript
// src/modules/dte/domain/entities/dte-document.entity.ts
export class DteDocument {
  constructor(
    public readonly codigoGeneracion: string,
    public readonly fechaEmision: string,
    public readonly receptorNrc: string,
    public readonly emisorNrc: string,
    public readonly totalExenta: number,
    public readonly totalGravada: number,
    public readonly totalPagar: number,
    public readonly tributosValor: number,
  ) {}

  static fromJson(json: any): DteDocument | null {
    try {
      return new DteDocument(
        json.identificacion?.codigoGeneracion?.replace(/-/g, '') ?? '',
        json.identificacion?.fecEmi ?? '',
        json.receptor?.nrc ?? '',
        json.emisor?.nrc ?? '',
        json.resumen?.totalExenta ?? 0,
        json.resumen?.totalGravada ?? 0,
        json.resumen?.totalPagar ?? 0,
        json.resumen?.tributos?.valor ?? 0,
      );
    } catch {
      return null;
    }
  }

  get formattedDate(): string {
    if (!this.fechaEmision) return '';
    const date = new Date(this.fechaEmision);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}/${date.getFullYear()}`;
  }
}
```

---

## Task 6: Update PrismaDteAdapter

**Files:**
- Modify: `src/modules/dte/infrastructure/adapters/prisma-dte.adapter.ts`

- [ ] **Step 1: Replace file**

```typescript
// src/modules/dte/infrastructure/adapters/prisma-dte.adapter.ts
import { Injectable } from '@nestjs/common';
import { DteType as PrismaDteType } from '@prisma/client';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { DteRepository, DteRecord, DteType } from '../../domain/ports/dte-repository.port';
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
        receiverNrc: dte.receptorNrc || null,
        issuerNrc: dte.emisorNrc,
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

  async updateClassification(generationCode: string, itemsCategory: string[]): Promise<void> {
    await this.prisma.dte.update({
      where: { generationCode },
      data: { itemsCategory },
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
      record.receiverNrc ?? '',
      record.issuerNrc,
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
          r.receiverNrc ?? '',
          r.issuerNrc,
          r.exemptTotal,
          r.taxableTotal,
          r.amountDue,
          r.taxValue,
        ),
    );
  }

  async findByPeriod(year: number, month: number, type: DteType): Promise<DteRecord[]> {
    const monthStr = month.toString().padStart(2, '0');
    const prefix = `${year}-${monthStr}`;

    const records = await this.prisma.dte.findMany({
      where: {
        type: this.toPrismaType(type),
        issueDate: { startsWith: prefix },
      },
      orderBy: { issueDate: 'asc' },
      include: {
        issuer: {
          include: { activity: true },
        },
      },
    });

    return records.map((r) => ({
      generationCode: r.generationCode,
      type,
      issueDate: r.issueDate,
      receiverNrc: r.receiverNrc,
      issuerNrc: r.issuerNrc,
      exemptTotal: r.exemptTotal,
      taxableTotal: r.taxableTotal,
      amountDue: r.amountDue,
      taxValue: r.taxValue,
      pdfUrl: r.pdfUrl,
      issuerDescActividad: r.issuer?.activity?.descActividad ?? null,
      itemsCategory: Array.isArray(r.itemsCategory) ? (r.itemsCategory as string[]) : null,
      createdAt: r.createdAt,
    }));
  }

  async findRawJson(generationCode: string): Promise<object | null> {
    const record = await this.prisma.dte.findUnique({
      where: { generationCode },
      select: { rawJson: true },
    });
    if (!record) return null;
    return record.rawJson as object;
  }

  private toPrismaType(type: DteType): PrismaDteType {
    return type === 'purchase' ? PrismaDteType.purchase : PrismaDteType.sale;
  }
}
```

---

## Task 7: Update FetchDteEmailsHandler

**Files:**
- Modify: `src/modules/dte/application/commands/fetch-dte-emails/fetch-dte-emails.handler.ts`

- [ ] **Step 1: Replace file**

```typescript
// src/modules/dte/application/commands/fetch-dte-emails/fetch-dte-emails.handler.ts
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { FetchDteEmailsCommand } from './fetch-dte-emails.command';
import { EmailReaderPort, EMAIL_READER } from '../../../domain/ports/email-reader.port';
import { FileStoragePort, FILE_STORAGE } from '../../../domain/ports/file-storage.port';
import { DteRepository, DTE_REPOSITORY } from '../../../domain/ports/dte-repository.port';
import { TaxpayerRepository, TAXPAYER_REPOSITORY } from '../../../../taxpayer/domain/ports/taxpayer-repository.port';
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

      if (dteDoc) {
        const existing = await this.dteRepository.findByGenerationCode(dteDoc.codigoGeneracion);
        if (existing) {
          this.logService.log(
            `DTE ${dteDoc.codigoGeneracion} already exists in DB. Skipping save, classifying if needed...`,
            'dte',
          );
          await this.upsertTaxpayers(rawJson).catch((err) =>
            this.logService.log(`Taxpayer upsert failed for existing DTE: ${err.message}`, 'dte'),
          );
          await this.classifyDte(dteDoc.codigoGeneracion, rawJson).catch((err) =>
            this.logService.log(
              `Classification failed for ${dteDoc.codigoGeneracion}: ${err.message}`,
              'dte',
            ),
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
        // Upsert taxpayers BEFORE save to satisfy FK constraints
        await this.upsertTaxpayers(rawJson);

        await this.dteRepository.save(dteDoc, type, lastPdfUrl, rawJson);
        this.logService.log(`Saved DTE to DB: ${dteDoc.codigoGeneracion}`, 'dte');

        await this.classifyDte(dteDoc.codigoGeneracion, rawJson).catch((err) =>
          this.logService.log(
            `Classification failed for ${dteDoc.codigoGeneracion}: ${err.message}`,
            'dte',
          ),
        );
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

  private async upsertTaxpayers(rawJson: any): Promise<void> {
    const emisor = rawJson?.emisor;
    if (emisor?.nrc) {
      const { nrc, nit, nombre, nombreComercial, codActividad, descActividad, ...rest } = emisor;
      await this.taxpayerRepository.upsert(nrc, {
        nit: nit ?? null,
        nombre: (nombre as string)?.toUpperCase() ?? '',
        nombreComercial: nombreComercial ?? null,
        codActividad: codActividad ?? null,
        descActividad: descActividad ?? null,
        rawJson: rest,
      });
    }

    const receptor = rawJson?.receptor;
    if (receptor?.nrc) {
      const { nrc, nit, nombre, nombreComercial, codActividad, descActividad, ...rest } = receptor;
      await this.taxpayerRepository.upsert(nrc, {
        nit: nit ?? null,
        nombre: (nombre as string)?.toUpperCase() ?? '',
        nombreComercial: nombreComercial ?? null,
        codActividad: codActividad ?? null,
        descActividad: descActividad ?? null,
        rawJson: rest,
      });
    }
  }

  private async classifyDte(generationCode: string, rawJson: any): Promise<void> {
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
```

---

## Task 8: Update SendDteAttachmentsHandler

**Files:**
- Modify: `src/modules/dte/application/commands/send-dte-attachments/send-dte-attachments.handler.ts`

- [ ] **Step 1: Read the file to find the emisorNombre usage**

Read `src/modules/dte/application/commands/send-dte-attachments/send-dte-attachments.handler.ts` and locate the line `Column6: doc.emisorNombre`.

- [ ] **Step 2: Replace `doc.emisorNombre` with direct JSON read**

`doc` is created via `DteDocument.fromJson(jsonData)` where `jsonData` is the raw Drive JSON — `emisor.nombre` is still available there. Replace that single line:

```typescript
// BEFORE
Column6: doc.emisorNombre,

// AFTER
Column6: (jsonData?.emisor?.nombre as string)?.toUpperCase() ?? '',
```

---

## Task 9: Update GetDteFilesHandler summary

**Files:**
- Modify: `src/modules/dte/application/queries/get-dte-files/get-dte-files.handler.ts`

- [ ] **Step 1: Replace file**

`DteRecord` no longer has `issuerActivity` — use `issuerDescActividad` instead.

```typescript
// src/modules/dte/application/queries/get-dte-files/get-dte-files.handler.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetDteFilesQuery } from './get-dte-files.query';
import { DteRepository, DteRecord, DTE_REPOSITORY } from '../../../domain/ports/dte-repository.port';

interface CountEntry {
  name: string;
  count: number;
}

interface DteSummary {
  activities: CountEntry[];
  categories: CountEntry[];
}

export interface GetDteFilesResult {
  period: string;
  type: string;
  count: number;
  records: DteRecord[];
  summary: DteSummary;
}

@QueryHandler(GetDteFilesQuery)
export class GetDteFilesHandler implements IQueryHandler<GetDteFilesQuery, GetDteFilesResult> {
  constructor(@Inject(DTE_REPOSITORY) private readonly dteRepository: DteRepository) {}

  async execute(query: GetDteFilesQuery): Promise<GetDteFilesResult> {
    const { year, month, type } = query;
    const records = await this.dteRepository.findByPeriod(year, month, type);

    return {
      period: `${year}-${month.toString().padStart(2, '0')}`,
      type,
      count: records.length,
      records,
      summary: this.buildSummary(records),
    };
  }

  private buildSummary(records: DteRecord[]): DteSummary {
    const activityCounts = new Map<string, number>();
    const categoryCounts = new Map<string, number>();

    for (const record of records) {
      if (record.issuerDescActividad) {
        activityCounts.set(
          record.issuerDescActividad,
          (activityCounts.get(record.issuerDescActividad) ?? 0) + 1,
        );
      }

      if (Array.isArray(record.itemsCategory)) {
        for (const cat of record.itemsCategory) {
          categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
        }
      }
    }

    const toSorted = (map: Map<string, number>): CountEntry[] =>
      Array.from(map.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

    return {
      activities: toSorted(activityCounts),
      categories: toSorted(categoryCounts),
    };
  }
}
```

---

## Task 10: Update DteModule

**Files:**
- Modify: `src/modules/dte/dte.module.ts`

- [ ] **Step 1: Add TaxpayerModule import**

```typescript
// src/modules/dte/dte.module.ts
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

import { DteController } from './infrastructure/http/dte.controller';
import { DteScheduler } from './infrastructure/scheduled/dte.scheduler';
import { LogService } from '../../shared/logging/log.service';

@Module({
  imports: [CqrsModule, AuthModule, LlmModule, TaxpayerModule],
  controllers: [DteController],
  providers: [
    { provide: EMAIL_READER, useClass: GmailAdapter },
    { provide: FILE_STORAGE, useClass: GoogleDriveAdapter },
    { provide: EMAIL_SENDER, useClass: NodemailerAdapter },
    { provide: DTE_REPOSITORY, useClass: PrismaDteAdapter },

    FetchDteEmailsHandler,
    SendDteAttachmentsHandler,
    GetDteFilesHandler,
    GetDteDetailHandler,

    DteScheduler,
    LogService,
  ],
})
export class DteModule {}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

---

## Task 11: Create and run migration

**Files:**
- Create: `prisma/migrations/<timestamp>_add_taxpayer_catalog/migration.sql`

> **Warning:** This migration drops columns (`issuer_name`, `receiver_name`, `issuer_activity`) and adds FK constraints. It cannot be rolled back without a full restore. Verify you have a DB backup before running.

- [ ] **Step 1: Generate migration scaffold (create-only)**

```bash
npx prisma migrate dev --create-only --name add_taxpayer_catalog
```

This creates `prisma/migrations/<timestamp>_add_taxpayer_catalog/migration.sql` without running it.

- [ ] **Step 2: Replace generated SQL with the full migration**

Open the generated file and replace its entire contents with:

```sql
-- CreateTable activity
CREATE TABLE "activity" (
    "cod_actividad" TEXT NOT NULL,
    "desc_actividad" TEXT NOT NULL,
    CONSTRAINT "activity_pkey" PRIMARY KEY ("cod_actividad")
);

-- CreateTable taxpayer
CREATE TABLE "taxpayer" (
    "id" TEXT NOT NULL,
    "nrc" TEXT,
    "nit" TEXT,
    "nombre" TEXT NOT NULL,
    "nombre_comercial" TEXT,
    "cod_actividad" TEXT,
    "raw_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT "taxpayer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex unique nrc
CREATE UNIQUE INDEX "taxpayer_nrc_key" ON "taxpayer"("nrc");

-- Data migration: populate activity from emisor
INSERT INTO "activity" ("cod_actividad", "desc_actividad")
SELECT DISTINCT
    raw_json->'emisor'->>'codActividad',
    raw_json->'emisor'->>'descActividad'
FROM "dte"
WHERE raw_json->'emisor'->>'codActividad' IS NOT NULL
  AND raw_json->'emisor'->>'descActividad' IS NOT NULL
ON CONFLICT ("cod_actividad") DO NOTHING;

-- Data migration: populate activity from receptor
INSERT INTO "activity" ("cod_actividad", "desc_actividad")
SELECT DISTINCT
    raw_json->'receptor'->>'codActividad',
    raw_json->'receptor'->>'descActividad'
FROM "dte"
WHERE raw_json->'receptor'->>'codActividad' IS NOT NULL
  AND raw_json->'receptor'->>'descActividad' IS NOT NULL
ON CONFLICT ("cod_actividad") DO NOTHING;

-- Data migration: populate taxpayer from emisor
INSERT INTO "taxpayer" ("id", "nrc", "nit", "nombre", "nombre_comercial", "cod_actividad", "raw_json", "created_at", "updated_at")
SELECT DISTINCT ON (raw_json->'emisor'->>'nrc')
    gen_random_uuid()::TEXT,
    raw_json->'emisor'->>'nrc',
    raw_json->'emisor'->>'nit',
    UPPER(raw_json->'emisor'->>'nombre'),
    raw_json->'emisor'->>'nombreComercial',
    raw_json->'emisor'->>'codActividad',
    raw_json->'emisor',
    NOW(),
    NOW()
FROM "dte"
WHERE raw_json->'emisor'->>'nrc' IS NOT NULL
ORDER BY raw_json->'emisor'->>'nrc'
ON CONFLICT ("nrc") DO NOTHING;

-- Data migration: populate taxpayer from receptor
INSERT INTO "taxpayer" ("id", "nrc", "nit", "nombre", "nombre_comercial", "cod_actividad", "raw_json", "created_at", "updated_at")
SELECT DISTINCT ON (raw_json->'receptor'->>'nrc')
    gen_random_uuid()::TEXT,
    raw_json->'receptor'->>'nrc',
    raw_json->'receptor'->>'nit',
    UPPER(raw_json->'receptor'->>'nombre'),
    raw_json->'receptor'->>'nombreComercial',
    raw_json->'receptor'->>'codActividad',
    raw_json->'receptor',
    NOW(),
    NOW()
FROM "dte"
WHERE raw_json->'receptor'->>'nrc' IS NOT NULL
  AND raw_json->'receptor'->>'nrc' != ''
ORDER BY raw_json->'receptor'->>'nrc'
ON CONFLICT ("nrc") DO NOTHING;

-- Convert empty receiver_nrc to NULL before adding FK
UPDATE "dte" SET "receiver_nrc" = NULL WHERE "receiver_nrc" = '';

-- Make receiver_nrc nullable
ALTER TABLE "dte" ALTER COLUMN "receiver_nrc" DROP NOT NULL;

-- AddForeignKey taxpayer → activity
ALTER TABLE "taxpayer" ADD CONSTRAINT "taxpayer_cod_actividad_fkey"
    FOREIGN KEY ("cod_actividad") REFERENCES "activity"("cod_actividad")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey dte.issuer_nrc → taxpayer.nrc
ALTER TABLE "dte" ADD CONSTRAINT "dte_issuer_nrc_fkey"
    FOREIGN KEY ("issuer_nrc") REFERENCES "taxpayer"("nrc")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey dte.receiver_nrc → taxpayer.nrc
ALTER TABLE "dte" ADD CONSTRAINT "dte_receiver_nrc_fkey"
    FOREIGN KEY ("receiver_nrc") REFERENCES "taxpayer"("nrc")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- DropColumn issuer_name, receiver_name, issuer_activity
ALTER TABLE "dte" DROP COLUMN "issuer_name";
ALTER TABLE "dte" DROP COLUMN "receiver_name";
ALTER TABLE "dte" DROP COLUMN "issuer_activity";
```

- [ ] **Step 3: Apply migration**

```bash
npx prisma migrate dev
```

Expected: `Your database is now in sync with your schema.`

If it fails with FK constraint violation, it means some DTE rows have `issuer_nrc` values not found in `taxpayer`. This means those DTEs have a malformed/missing `emisor.nrc` in `raw_json`. Investigate with:

```sql
SELECT generation_code, raw_json->'emisor'->>'nrc' as emisor_nrc
FROM dte
WHERE issuer_nrc NOT IN (SELECT nrc FROM taxpayer WHERE nrc IS NOT NULL);
```

- [ ] **Step 4: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client` in output.

- [ ] **Step 5: Verify TypeScript still compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Single commit**

```bash
git add -A
git commit -m "feat(taxpayer): normalizar emisor/receptor en tabla taxpayer con catálogo de actividades"
```
