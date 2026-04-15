# Prisma + PostgreSQL Integration for DTE Module

**Date:** 2026-04-15  
**Status:** Approved

## Context

NestJS API with hexagonal architecture + CQRS. Currently stateless — DTE documents are fetched from email, processed, and stored in Google Drive. Goal: persist DTE documents in PostgreSQL via Prisma to enable querying, deduplication, and CSV generation.

## Schema

```prisma
enum DteType {
  purchase
  sale
}

model Dte {
  generationCode   String   @id @map("generation_code")
  type             DteType
  issueDate        String   @map("issue_date")
  receiverNrc      String   @map("receiver_nrc")
  issuerNrc        String   @map("issuer_nrc")
  issuerName       String   @map("issuer_name")
  exemptTotal      Float    @map("exempt_total")
  taxableTotal     Float    @map("taxable_total")
  amountDue        Float    @map("amount_due")
  taxValue         Float    @map("tax_value")
  pdfUrl           String?  @map("pdf_url")
  rawJson          Json     @map("raw_json")
  createdAt        DateTime @default(now()) @map("created_at")

  @@map("dte")
}
```

- `generationCode` is the natural primary key (UUID from the DTE document).
- `rawJson` stores the full DTE JSON for future use.
- Individual fields allow direct SQL queries for CSV export without deserializing JSON.
- `pdfUrl` is optional — populated after upload to Google Drive.

## Architecture

### New files

```
src/
├── shared/
│   └── database/
│       ├── prisma.service.ts        # NestJS provider extending PrismaClient
│       └── database.module.ts       # Global module exporting PrismaService
│
└── modules/dte/
    ├── domain/
    │   └── ports/
    │       └── dte-repository.port.ts   # Repository interface (port)
    │
    └── infrastructure/
        └── adapters/
            └── prisma-dte.adapter.ts    # Prisma implementation of the port
```

### Data flow

1. `FetchDteEmailsHandler` fetches and parses DTE emails.
2. Handler calls `DteRepository.save(dte, type)` — uses the port, not Prisma directly.
3. `PrismaDteAdapter` implements the port and writes to PostgreSQL via `PrismaService`.
4. `PrismaService` is injected only in the infrastructure adapter layer.

## Port Interface

```typescript
export interface DteRepository {
  save(dte: DteDocument, type: DteType): Promise<void>;
  findByGenerationCode(code: string): Promise<DteDocument | null>;
  findAll(type?: DteType): Promise<DteDocument[]>;
}
```

- `save` — upsert by `generationCode` to handle reprocessing safely.
- `findByGenerationCode` — check for existence before processing.
- `findAll(type?)` — basis for CSV generation, filterable by type.

## Dependencies

- `prisma` (dev) — CLI for migrations and schema generation
- `@prisma/client` (prod) — runtime client

## Environment

`SUPABASE_DATABASE_URI` ya existe en `.env`. El `schema.prisma` usará esta variable:
```
datasource db {
  provider = "postgresql"
  url      = env("SUPABASE_DATABASE_URI")
}
```
