# Upload Sale DTE Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `POST /api/dte/upload` endpoint that accepts a DTE JSON file (required) and PDF (optional), parses data automatically, uploads to Google Drive, saves to DB, and runs LLM classification — all without the caller specifying year/month.

**Architecture:** New `UploadSaleDteCommand` + handler following the hexagonal CQRS pattern already in place. All ports (`FileStoragePort`, `DteRepository`, `TaxpayerRepository`, `LlmClassifierPort`) are reused unchanged. The handler mirrors `FetchDteEmailsHandler` logic minus email reading.

**Tech Stack:** NestJS 10, CQRS, `@nestjs/platform-express` (multer), TypeScript 5, Prisma 7, Google Drive API

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/modules/dte/application/commands/upload-sale-dte/upload-sale-dte.command.ts` | Command payload |
| Create | `src/modules/dte/application/commands/upload-sale-dte/upload-sale-dte.handler.ts` | Business logic |
| Create | `src/modules/dte/infrastructure/http/dto/upload-sale-dte.dto.ts` | Swagger docs for multipart |
| Modify | `src/modules/dte/infrastructure/http/dte.controller.ts` | New endpoint |
| Modify | `src/modules/dte/dte.module.ts` | Register new handler |

---

## Task 1: Install multer types

**Files:**
- Modify: `package.json` (devDependencies)

- [ ] **Step 1: Install `@types/multer`**

```bash
npm install --save-dev @types/multer
```

Expected output: added 1 package

- [ ] **Step 2: Verify TypeScript can resolve the type**

```bash
npx ts-node -e "import { Express } from 'express'; const f: Express.Multer.File = {} as any; console.log('ok')"
```

Expected output: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @types/multer for file upload typing"
```

---

## Task 2: Command class

**Files:**
- Create: `src/modules/dte/application/commands/upload-sale-dte/upload-sale-dte.command.ts`

- [ ] **Step 1: Create the command**

```typescript
export class UploadSaleDteCommand {
  constructor(
    public readonly jsonBuffer: Buffer,
    public readonly pdfBuffer?: Buffer,
  ) {}
}
```

Save to: `src/modules/dte/application/commands/upload-sale-dte/upload-sale-dte.command.ts`

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/modules/dte/application/commands/upload-sale-dte/upload-sale-dte.command.ts
git commit -m "feat(dte): add UploadSaleDteCommand"
```

---

## Task 3: Handler

**Files:**
- Create: `src/modules/dte/application/commands/upload-sale-dte/upload-sale-dte.handler.ts`

> Reference: `src/modules/dte/application/commands/fetch-dte-emails/fetch-dte-emails.handler.ts` — this handler follows the same port injection pattern and the same non-blocking Drive/LLM error handling.

- [ ] **Step 1: Create the handler**

```typescript
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, BadRequestException, ConflictException } from '@nestjs/common';
import { UploadSaleDteCommand } from './upload-sale-dte.command';
import { FileStoragePort, FILE_STORAGE } from '../../../domain/ports/file-storage.port';
import { DteRepository, DTE_REPOSITORY } from '../../../domain/ports/dte-repository.port';
import { TaxpayerRepository, TAXPAYER_REPOSITORY } from '../../../../../modules/taxpayer/domain/ports/taxpayer-repository.port';
import { LlmClassifierPort, LLM_CLASSIFIER } from '../../../../llm/domain/ports/llm-classifier.port';
import { DteDocument } from '../../../domain/entities/dte-document.entity';
import { LogService } from '../../../../../shared/logging/log.service';

export interface UploadSaleDteResult {
  generationCode: string;
  issueDate: string;
  amountDue: number;
  classification: string[];
}

@CommandHandler(UploadSaleDteCommand)
export class UploadSaleDteHandler
  implements ICommandHandler<UploadSaleDteCommand, UploadSaleDteResult>
{
  constructor(
    @Inject(FILE_STORAGE) private readonly fileStorage: FileStoragePort,
    @Inject(DTE_REPOSITORY) private readonly dteRepository: DteRepository,
    @Inject(TAXPAYER_REPOSITORY) private readonly taxpayerRepository: TaxpayerRepository,
    @Inject(LLM_CLASSIFIER) private readonly llmClassifier: LlmClassifierPort,
    private readonly logService: LogService,
  ) {}

  async execute(command: UploadSaleDteCommand): Promise<UploadSaleDteResult> {
    // 1. Parse JSON
    let rawJson: any;
    try {
      rawJson = JSON.parse(command.jsonBuffer.toString('utf-8').trim());
    } catch {
      throw new BadRequestException('El archivo JSON no es válido.');
    }

    // 2. Build domain entity
    const dteDoc = DteDocument.fromJson(rawJson);
    if (!dteDoc) {
      throw new BadRequestException('El JSON no contiene un DTE válido (faltan campos requeridos).');
    }

    // 3. Duplicate check
    const existing = await this.dteRepository.findByGenerationCode(dteDoc.codigoGeneracion);
    if (existing) {
      throw new ConflictException(
        `DTE ${dteDoc.codigoGeneracion} ya existe en la base de datos.`,
      );
    }

    // 4. Drive folder from DTE date
    const fecEmi: string = rawJson.identificacion?.fecEmi ?? dteDoc.fechaEmision;
    const [year, month] = fecEmi.split('-');
    const driveFolderPath = `dte/${year}/${month}/ventas`;

    // 5. Upload JSON to Drive (non-blocking)
    const jsonFilename = `${dteDoc.codigoGeneracion}.json`;
    const jsonDriveId = await this.fileStorage
      .upload(jsonFilename, command.jsonBuffer, 'application/json', driveFolderPath)
      .catch((err) => {
        this.logService.log(`Drive JSON upload failed: ${err.message}`, 'dte');
        return null;
      });
    if (jsonDriveId) {
      this.logService.log(`Uploaded JSON to Drive: ${jsonDriveId}`, 'dte');
    }

    // 6. Upload PDF to Drive (non-blocking, optional)
    let pdfUrl: string | undefined;
    if (command.pdfBuffer) {
      const pdfFilename = `${dteDoc.codigoGeneracion}.pdf`;
      const pdfDriveId = await this.fileStorage
        .upload(pdfFilename, command.pdfBuffer, 'application/pdf', driveFolderPath)
        .catch((err) => {
          this.logService.log(`Drive PDF upload failed: ${err.message}`, 'dte');
          return null;
        });
      if (pdfDriveId) {
        pdfUrl = `https://drive.google.com/file/d/${pdfDriveId}/view`;
        this.logService.log(`Uploaded PDF to Drive: ${pdfDriveId}`, 'dte');
      }
    }

    // 7. Upsert emisor
    if (rawJson.emisor?.nrc) {
      await this.taxpayerRepository.upsert(rawJson.emisor.nrc, {
        nit: rawJson.emisor.nit,
        nombre: rawJson.emisor.nombre || '',
        nombreComercial: rawJson.emisor.nombreComercial,
        codActividad: rawJson.emisor.codActividad,
        descActividad: rawJson.emisor.descActividad,
        rawJson: rawJson.emisor,
      });
    }

    // 8. Upsert receptor
    if (rawJson.receptor?.nrc) {
      await this.taxpayerRepository.upsert(rawJson.receptor.nrc, {
        nit: rawJson.receptor.nit,
        nombre: rawJson.receptor.nombre || '',
        nombreComercial: rawJson.receptor.nombreComercial,
        codActividad: rawJson.receptor.codActividad,
        descActividad: rawJson.receptor.descActividad,
        rawJson: rawJson.receptor,
      });
    }

    // 9. Save DTE
    await this.dteRepository.save(dteDoc, 'sale', pdfUrl, rawJson);
    this.logService.log(`Saved sale DTE: ${dteDoc.codigoGeneracion}`, 'dte');

    // 10. LLM classify (non-blocking)
    let classification: string[] = [];
    try {
      const cuerpo: any[] = Array.isArray(rawJson.cuerpoDocumento) ? rawJson.cuerpoDocumento : [];
      const descriptions = cuerpo
        .map((item: any) => item?.descripcion)
        .filter((d): d is string => typeof d === 'string' && d.trim().length > 0);

      if (descriptions.length > 0) {
        classification = await this.llmClassifier.classifyItems(descriptions);
        await this.dteRepository.updateClassification(dteDoc.codigoGeneracion, classification);
        this.logService.log(
          `Classified DTE ${dteDoc.codigoGeneracion}: ${classification.length} categories`,
          'dte',
        );
      }
    } catch (err: any) {
      this.logService.log(
        `Classification failed for ${dteDoc.codigoGeneracion}: ${err.message}`,
        'dte',
      );
    }

    return {
      generationCode: dteDoc.codigoGeneracion,
      issueDate: dteDoc.fechaEmision,
      amountDue: dteDoc.totalPagar,
      classification,
    };
  }
}
```

Save to: `src/modules/dte/application/commands/upload-sale-dte/upload-sale-dte.handler.ts`

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/modules/dte/application/commands/upload-sale-dte/
git commit -m "feat(dte): add UploadSaleDteHandler"
```

---

## Task 4: Swagger DTO

**Files:**
- Create: `src/modules/dte/infrastructure/http/dto/upload-sale-dte.dto.ts`

- [ ] **Step 1: Create the DTO**

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UploadSaleDteDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Archivo JSON del DTE (requerido)',
  })
  json: Express.Multer.File;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Archivo PDF del DTE (opcional)',
  })
  pdf?: Express.Multer.File;
}
```

Save to: `src/modules/dte/infrastructure/http/dto/upload-sale-dte.dto.ts`

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/modules/dte/infrastructure/http/dto/upload-sale-dte.dto.ts
git commit -m "feat(dte): add UploadSaleDteDto"
```

---

## Task 5: Controller endpoint

**Files:**
- Modify: `src/modules/dte/infrastructure/http/dte.controller.ts`

- [ ] **Step 1: Add imports at top of controller**

Add these imports (after existing imports):

```typescript
import {
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiBody } from '@nestjs/swagger';
import { UploadSaleDteCommand } from '../../application/commands/upload-sale-dte/upload-sale-dte.command';
import { UploadSaleDteDto } from './dto/upload-sale-dte.dto';
```

- [ ] **Step 2: Add endpoint method to DteController class**

Add after the `getDteDetail` method, before `sendDteAttachments`:

```typescript
@Post('dte/upload')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Sube manualmente una venta (DTE). JSON requerido, PDF opcional.' })
@ApiConsumes('multipart/form-data')
@ApiBody({ type: UploadSaleDteDto })
@ApiResponse({ status: 200, description: 'DTE procesado y guardado.' })
@ApiResponse({ status: 400, description: 'JSON inválido o campos DTE faltantes.' })
@ApiResponse({ status: 409, description: 'El DTE ya existe.' })
@ApiResponse({ status: 500, description: 'Error interno.' })
@UseInterceptors(
  FileFieldsInterceptor([
    { name: 'json', maxCount: 1 },
    { name: 'pdf', maxCount: 1 },
  ]),
)
async uploadSaleDte(
  @UploadedFiles()
  files: {
    json?: Express.Multer.File[];
    pdf?: Express.Multer.File[];
  },
) {
  if (!files?.json?.[0]) {
    throw new BadRequestException('El archivo JSON es requerido.');
  }

  try {
    const result = await this.commandBus.execute(
      new UploadSaleDteCommand(
        files.json[0].buffer,
        files.pdf?.[0]?.buffer,
      ),
    );
    return { success: true, ...result };
  } catch (err: any) {
    if (err instanceof HttpException) throw err;
    throw new InternalServerErrorException('Error al procesar el DTE.');
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/modules/dte/infrastructure/http/dte.controller.ts
git commit -m "feat(dte): add POST /api/dte/upload endpoint"
```

---

## Task 6: Register handler in module

**Files:**
- Modify: `src/modules/dte/dte.module.ts`

- [ ] **Step 1: Add import**

Add this import after `GetDteDetailHandler` import:

```typescript
import { UploadSaleDteHandler } from './application/commands/upload-sale-dte/upload-sale-dte.handler';
```

- [ ] **Step 2: Add to providers array**

In the `providers` array, after `GetDteDetailHandler,`:

```typescript
UploadSaleDteHandler,
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/modules/dte/dte.module.ts
git commit -m "feat(dte): register UploadSaleDteHandler in DteModule"
```

---

## Task 7: Manual smoke test

- [ ] **Step 1: Start dev server**

```bash
npm run start:dev
```

Expected: server running on port 9000 (or PORT env), no errors

- [ ] **Step 2: Test missing JSON → 400**

```bash
curl -s -X POST http://localhost:9000/api/dte/upload \
  -H "Authorization: Bearer <your_jwt_token>" \
  | jq .
```

Expected:
```json
{ "statusCode": 400, "message": "El archivo JSON es requerido." }
```

- [ ] **Step 3: Test invalid JSON → 400**

```bash
curl -s -X POST http://localhost:9000/api/dte/upload \
  -H "Authorization: Bearer <your_jwt_token>" \
  -F "json=@/dev/stdin;filename=bad.json" <<< "not-json" \
  | jq .
```

Expected:
```json
{ "statusCode": 400, "message": "El archivo JSON no es válido." }
```

- [ ] **Step 4: Test valid DTE JSON + PDF → 200**

Use the sample JSON (`7C7FDC36-999D-4452-91FC-C5207E00A7CB.json`) and PDF:

```bash
curl -s -X POST http://localhost:9000/api/dte/upload \
  -H "Authorization: Bearer <your_jwt_token>" \
  -F "json=@7C7FDC36-999D-4452-91FC-C5207E00A7CB.json" \
  -F "pdf=@7C7FDC36-999D-4452-91FC-C5207E00A7CB.pdf" \
  | jq .
```

Expected:
```json
{
  "success": true,
  "generationCode": "7C7FDC36999D445291FCC5207E00A7CB",
  "issueDate": "2026-01-14",
  "amountDue": 2279.65,
  "classification": ["..."]
}
```

- [ ] **Step 5: Test duplicate → 409**

Run the same command again:

Expected:
```json
{ "statusCode": 409, "message": "DTE 7C7FDC36... ya existe en la base de datos." }
```

- [ ] **Step 6: Verify Drive folder**

Check Google Drive for folder `dte/2026/01/ventas` containing the uploaded JSON and PDF.

- [ ] **Step 7: Final commit if any adjustments were made**

```bash
git add -p
git commit -m "fix(dte): smoke test adjustments"
```
