# LLM DTE Classification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich DTE records with AI-derived `issuerActivity` (from `raw_json.emisor.descActividad`) and `itemsCategory` (Groq/Llama classification of `cuerpoDocumento` items), and expose a `summary` aggregation on `GET /api/dte/:year/:month/:type`.

**Architecture:** New `llm` module with hexagonal pattern (port + Groq adapter). Classification runs inside `FetchDteEmailsHandler` after each DTE is persisted — non-blocking. `GetDteFilesHandler` computes `summary` in-memory from fetched records.

**Tech Stack:** NestJS CQRS, Prisma 7, Node 18 native `fetch`, Groq API (OpenAI-compatible, `llama-3.3-70b-versatile`), PostgreSQL via Supabase.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `prisma/schema.prisma` | Add `issuerActivity`, `itemsCategory` fields |
| Create | `src/modules/llm/domain/ports/llm-classifier.port.ts` | Port interface + DI token |
| Create | `src/modules/llm/infrastructure/adapters/groq.adapter.ts` | Groq HTTP adapter |
| Create | `src/modules/llm/llm.module.ts` | NestJS module, exports adapter |
| Modify | `src/modules/dte/domain/ports/dte-repository.port.ts` | Add `issuerActivity`/`itemsCategory` to `DteRecord`, add `updateClassification` method |
| Modify | `src/modules/dte/infrastructure/adapters/prisma-dte.adapter.ts` | Implement `updateClassification`, include new fields in `findByPeriod` |
| Modify | `src/modules/dte/application/commands/fetch-dte-emails/fetch-dte-emails.handler.ts` | Inject classifier, call after save |
| Modify | `src/modules/dte/application/queries/get-dte-files/get-dte-files.handler.ts` | Compute and return `summary` |
| Modify | `src/modules/dte/dte.module.ts` | Import `LlmModule` |
| Modify | `src/app.module.ts` | Import `LlmModule` globally (optional, see Task 7) |

---

## Task 1: Prisma schema — add classification fields

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add fields to `Dte` model**

Open `prisma/schema.prisma`. After the `pdfUrl` line (line 26), add:

```prisma
  issuerActivity String?  @map("issuer_activity")
  itemsCategory  Json?    @map("items_category")
```

Full updated model:

```prisma
model Dte {
  generationCode String   @id @map("generation_code")
  type           DteType
  issueDate      String   @map("issue_date")
  receiverNrc    String   @map("receiver_nrc")
  receiverName   String   @default("") @map("receiver_name")
  issuerNrc      String   @map("issuer_nrc")
  issuerName     String   @map("issuer_name")
  exemptTotal    Float    @map("exempt_total")
  taxableTotal   Float    @map("taxable_total")
  amountDue      Float    @map("amount_due")
  taxValue       Float    @map("tax_value")
  pdfUrl         String?  @map("pdf_url")
  issuerActivity String?  @map("issuer_activity")
  itemsCategory  Json?    @map("items_category")
  rawJson        Json     @map("raw_json")
  createdAt      DateTime @default(now()) @map("created_at")

  @@map("dte")
}
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add_classification_fields
```

Expected output: `Your database is now in sync with your schema.`

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client` in output.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(prisma): add issuer_activity and items_category to dte"
```

---

## Task 2: LLM domain port

**Files:**
- Create: `src/modules/llm/domain/ports/llm-classifier.port.ts`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p src/modules/llm/domain/ports
mkdir -p src/modules/llm/infrastructure/adapters
```

- [ ] **Step 2: Create port file**

```typescript
// src/modules/llm/domain/ports/llm-classifier.port.ts
export const LLM_CLASSIFIER = 'LLM_CLASSIFIER';

export interface LlmClassifierPort {
  /**
   * Classifies an array of item descriptions.
   * Returns a string[] parallel to the input — one category per item.
   * Categories are open Spanish labels: "gasolina", "hardware", "seguros", etc.
   */
  classifyItems(descriptions: string[]): Promise<string[]>;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/llm/
git commit -m "feat(llm): add LlmClassifierPort domain interface"
```

---

## Task 3: Groq adapter

**Files:**
- Create: `src/modules/llm/infrastructure/adapters/groq.adapter.ts`

- [ ] **Step 1: Create adapter**

Node 18 has native `fetch` — no extra dependency needed.

```typescript
// src/modules/llm/infrastructure/adapters/groq.adapter.ts
import { Injectable } from '@nestjs/common';
import { LlmClassifierPort } from '../../domain/ports/llm-classifier.port';

@Injectable()
export class GroqAdapter implements LlmClassifierPort {
  private readonly apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
  private readonly model = 'llama-3.3-70b-versatile';

  async classifyItems(descriptions: string[]): Promise<string[]> {
    if (descriptions.length === 0) return [];

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY environment variable is not set');

    const prompt = `You are a procurement classifier. Given a list of purchase item descriptions in Spanish, classify each one with a short Spanish category label (e.g. "gasolina", "seguros", "hardware", "fontanería", "alimentación", "servicios profesionales", "papelería", "transporte", "electricidad", "telecomunicaciones").

Return ONLY a JSON object with a single key "categories" containing an array of category strings, one per input item, in the same order.

Items:
${descriptions.map((d, i) => `${i + 1}. ${d}`).join('\n')}`;

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Groq API error ${response.status}: ${text}`);
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Groq returned empty content');

    const parsed = JSON.parse(content) as { categories: string[] };
    if (!Array.isArray(parsed.categories)) {
      throw new Error('Groq response missing "categories" array');
    }

    // Ensure output length matches input — pad with "sin categoría" if needed
    const result = parsed.categories.slice(0, descriptions.length);
    while (result.length < descriptions.length) {
      result.push('sin categoría');
    }
    return result;
  }
}
```

- [ ] **Step 2: Create LlmModule**

```typescript
// src/modules/llm/llm.module.ts
import { Module } from '@nestjs/common';
import { GroqAdapter } from './infrastructure/adapters/groq.adapter';
import { LLM_CLASSIFIER } from './domain/ports/llm-classifier.port';

@Module({
  providers: [
    { provide: LLM_CLASSIFIER, useClass: GroqAdapter },
  ],
  exports: [LLM_CLASSIFIER],
})
export class LlmModule {}
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/llm/
git commit -m "feat(llm): add GroqAdapter and LlmModule"
```

---

## Task 4: Update DteRepository port and DteRecord type

**Files:**
- Modify: `src/modules/dte/domain/ports/dte-repository.port.ts`

- [ ] **Step 1: Add new fields to `DteRecord` and new method to `DteRepository`**

Replace the entire file:

```typescript
// src/modules/dte/domain/ports/dte-repository.port.ts
import { DteDocument } from '../entities/dte-document.entity';

export const DTE_REPOSITORY = 'DTE_REPOSITORY';

export type DteType = 'purchase' | 'sale';

export interface DteRecord {
  generationCode: string;
  type: DteType;
  issueDate: string;
  receiverNrc: string;
  receiverName: string;
  issuerNrc: string;
  issuerName: string;
  exemptTotal: number;
  taxableTotal: number;
  amountDue: number;
  taxValue: number;
  pdfUrl: string | null;
  issuerActivity: string | null;
  itemsCategory: string[] | null;
  createdAt: Date;
}

export interface DteRepository {
  save(dte: DteDocument, type: DteType, pdfUrl?: string, rawJson?: object): Promise<void>;
  findByGenerationCode(code: string): Promise<DteDocument | null>;
  findAll(type?: DteType): Promise<DteDocument[]>;
  findByPeriod(year: number, month: number, type: DteType): Promise<DteRecord[]>;
  findRawJson(generationCode: string): Promise<object | null>;
  updateClassification(
    generationCode: string,
    issuerActivity: string | null,
    itemsCategory: string[],
  ): Promise<void>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/dte/domain/ports/dte-repository.port.ts
git commit -m "feat(dte): add issuerActivity/itemsCategory to DteRecord and updateClassification port"
```

---

## Task 5: Update PrismaDteAdapter

**Files:**
- Modify: `src/modules/dte/infrastructure/adapters/prisma-dte.adapter.ts`

- [ ] **Step 1: Implement `updateClassification` and update `findByPeriod`**

Replace the entire file:

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
        receiverNrc: dte.receptorNrc,
        receiverName: dte.receptorNombre,
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

  async updateClassification(
    generationCode: string,
    issuerActivity: string | null,
    itemsCategory: string[],
  ): Promise<void> {
    await this.prisma.dte.update({
      where: { generationCode },
      data: {
        issuerActivity,
        itemsCategory,
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
      record.receiverName,
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
          r.receiverName,
          r.issuerNrc,
          r.issuerName,
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
    });

    return records.map((r) => ({
      generationCode: r.generationCode,
      type,
      issueDate: r.issueDate,
      receiverNrc: r.receiverNrc,
      receiverName: r.receiverName,
      issuerNrc: r.issuerNrc,
      issuerName: r.issuerName,
      exemptTotal: r.exemptTotal,
      taxableTotal: r.taxableTotal,
      amountDue: r.amountDue,
      taxValue: r.taxValue,
      pdfUrl: r.pdfUrl,
      issuerActivity: r.issuerActivity,
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

- [ ] **Step 2: Commit**

```bash
git add src/modules/dte/infrastructure/adapters/prisma-dte.adapter.ts
git commit -m "feat(dte): implement updateClassification and include new fields in findByPeriod"
```

---

## Task 6: Update FetchDteEmailsHandler — call classifier after save

**Files:**
- Modify: `src/modules/dte/application/commands/fetch-dte-emails/fetch-dte-emails.handler.ts`

- [ ] **Step 1: Inject LlmClassifierPort and add classification logic**

Replace the entire file:

```typescript
// src/modules/dte/application/commands/fetch-dte-emails/fetch-dte-emails.handler.ts
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { FetchDteEmailsCommand } from './fetch-dte-emails.command';
import { EmailReaderPort, EMAIL_READER } from '../../../domain/ports/email-reader.port';
import { FileStoragePort, FILE_STORAGE } from '../../../domain/ports/file-storage.port';
import { DteRepository, DTE_REPOSITORY } from '../../../domain/ports/dte-repository.port';
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

        // Classify — non-blocking, errors logged but do not fail the sync
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

  private async classifyDte(generationCode: string, rawJson: any): Promise<void> {
    // Extract issuerActivity directly — no LLM needed
    const issuerActivity: string | null = rawJson?.emisor?.descActividad ?? null;

    // Extract item descriptions from cuerpoDocumento
    const cuerpo: any[] = Array.isArray(rawJson?.cuerpoDocumento) ? rawJson.cuerpoDocumento : [];
    const descriptions: string[] = cuerpo
      .map((item: any) => item?.descripcion)
      .filter((d): d is string => typeof d === 'string' && d.trim().length > 0);

    let itemsCategory: string[] = [];
    if (descriptions.length > 0) {
      itemsCategory = await this.llmClassifier.classifyItems(descriptions);
    }

    await this.dteRepository.updateClassification(generationCode, issuerActivity, itemsCategory);
    this.logService.log(
      `Classified DTE ${generationCode}: activity="${issuerActivity}", ${itemsCategory.length} item categories`,
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

- [ ] **Step 2: Commit**

```bash
git add src/modules/dte/application/commands/fetch-dte-emails/fetch-dte-emails.handler.ts
git commit -m "feat(dte): classify DTE items via Groq after save"
```

---

## Task 7: Update GetDteFilesHandler — add summary

**Files:**
- Modify: `src/modules/dte/application/queries/get-dte-files/get-dte-files.handler.ts`

- [ ] **Step 1: Add summary computation**

Replace the entire file:

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
      if (record.issuerActivity) {
        activityCounts.set(
          record.issuerActivity,
          (activityCounts.get(record.issuerActivity) ?? 0) + 1,
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

- [ ] **Step 2: Commit**

```bash
git add src/modules/dte/application/queries/get-dte-files/get-dte-files.handler.ts
git commit -m "feat(dte): add summary aggregation to GetDteFilesHandler"
```

---

## Task 8: Wire LlmModule into DteModule

**Files:**
- Modify: `src/modules/dte/dte.module.ts`

- [ ] **Step 1: Import LlmModule**

Replace the entire file:

```typescript
// src/modules/dte/dte.module.ts
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthModule } from '../auth/auth.module';
import { LlmModule } from '../llm/llm.module';

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
  imports: [CqrsModule, AuthModule, LlmModule],
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

    // Scheduler
    DteScheduler,

    // Shared
    LogService,
  ],
})
export class DteModule {}
```

- [ ] **Step 2: Add `GROQ_API_KEY` to your `.env` file**

```bash
echo "GROQ_API_KEY=your_key_here" >> .env
```

Replace `your_key_here` with the actual key from console.groq.com.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/modules/dte/dte.module.ts
git commit -m "feat(dte): wire LlmModule into DteModule"
```

---

## Task 9: Smoke test end-to-end

- [ ] **Step 1: Start dev server**

```bash
npm run start:dev
```

Expected: `Application is running on: http://localhost:9000`

- [ ] **Step 2: Trigger sync**

```bash
curl -X POST "http://localhost:9000/api/dte?type=purchase" \
  -H "Authorization: Bearer <your_jwt_token>"
```

Expected: `{"success":true,"message":"Processed X emails..."}`

Check logs for lines like:
```
Classified DTE <code>: activity="...", N item categories
```

- [ ] **Step 3: Query classified records**

```bash
curl "http://localhost:9000/api/dte/2026/4/purchase" \
  -H "Authorization: Bearer <your_jwt_token>"
```

Expected response includes:
```json
{
  "summary": {
    "activities": [{ "name": "...", "count": 1 }],
    "categories": [{ "name": "gasolina", "count": 2 }]
  }
}
```

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "chore: verify LLM classification end-to-end"
```
