# Taxpayer & Activity Catalog — Design Spec
**Date:** 2026-04-16
**Status:** Approved

## Goal

Extract `emisor`/`receptor` data from DTE records into a normalized `taxpayer` table (and an `activity` catalog), eliminating redundant columns from `dte`. The DTE table relates to taxpayers via NRC foreign key.

## New Tables

### `activity` — Economic activity catalog

```prisma
model Activity {
  codActividad  String     @id @map("cod_actividad")
  descActividad String     @map("desc_actividad")
  taxpayers     Taxpayer[]

  @@map("activity")
}
```

Populated automatically during sync whenever a new `codActividad` is encountered.

### `taxpayer` — Contributor registry

```prisma
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

  activity        Activity? @relation(fields: [codActividad], references: [codActividad])
  issuedDtes      Dte[]     @relation("issuer")
  receivedDtes    Dte[]     @relation("receiver")

  @@map("taxpayer")
}
```

**Typed columns:** `nrc`, `nit`, `nombre`, `nombreComercial`, `codActividad`

**`rawJson`:** complete `emisor`/`receptor` object from MH JSON minus the already-typed fields. Preserves all other fields (address, phone, email, etc.) without requiring schema changes if MH adds new fields.

**No-duplicate guarantee (two layers):**
1. `nrc @unique` DB constraint — rejects duplicate NRC at DB level
2. Always `upsert where: { nrc }` — never raw `create`

NRC is the business identifier. Same NRC as issuer in 50 DTEs = 1 `taxpayer` row. Same NRC as both issuer and receiver across DTEs = 1 `taxpayer` row with both `issuedDtes` and `receivedDtes` relations.

`nrc` is `String?` (nullable) to accommodate future `factura` support where final consumers have no NRC.

## Modified Table: `dte`

### Columns removed
- `issuer_name` — now in `taxpayer.nombre`
- `receiver_name` — now in `taxpayer.nombre`
- `issuer_activity` — now in `taxpayer.codActividad` / `activity.descActividad`

### Columns becoming FK relations
- `issuer_nrc String` → FK to `taxpayer.nrc` (not null — CCF always has issuer NRC)
- `receiver_nrc String` → becomes `String?`, FK nullable to `taxpayer.nrc` (future factura support)

```prisma
model Dte {
  // ... existing fields minus issuerName, receiverName, issuerActivity ...
  issuerNrc   String    @map("issuer_nrc")
  receiverNrc String?   @map("receiver_nrc")

  issuer   Taxpayer  @relation("issuer",   fields: [issuerNrc],   references: [nrc])
  receiver Taxpayer? @relation("receiver", fields: [receiverNrc], references: [nrc])

  @@map("dte")
}
```

## Integration Flow

Triggered during `POST /api/dte` sync in `FetchDteEmailsHandler`, before `dteRepository.save()`:

```
rawJson.emisor
  ├─ 1. upsertActivity(codActividad, descActividad)
  └─ 2. upsertTaxpayer(nrc, { nit, nombre, nombreComercial, codActividad, rawJson })

rawJson.receptor
  ├─ 1. upsertActivity(codActividad, descActividad)  [if codActividad present]
  └─ 2. upsertTaxpayer(nrc, { nit, nombre, nombreComercial, codActividad, rawJson })

3. dteRepository.save(dteDoc, type, pdfUrl, rawJson)
   → issuer_nrc and receiver_nrc FK constraints already satisfied
```

## New Domain Layer

### New module: `taxpayer`

```
src/modules/taxpayer/
  domain/
    ports/
      taxpayer-repository.port.ts   # TaxpayerRepository + TAXPAYER_REPOSITORY token
  infrastructure/
    adapters/
      prisma-taxpayer.adapter.ts    # implements TaxpayerRepository
  taxpayer.module.ts
```

### Port interface

```ts
export interface TaxpayerData {
  nit?: string;
  nombre: string;
  nombreComercial?: string;
  codActividad?: string;
  descActividad?: string;
  rawJson?: object;
}

export interface TaxpayerRepository {
  upsert(nrc: string, data: TaxpayerData): Promise<void>;
}
```

`upsert` handles both `activity` and `taxpayer` upserts in a single transaction:
1. If `codActividad` present → `upsert activity`
2. `upsert taxpayer where: { nrc }`

## Changes to Existing Code

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `Activity`, `Taxpayer` models; modify `Dte` |
| `dte-repository.port.ts` | Remove `issuerActivity` from `DteRecord`; `receiverName`/`issuerName` removed |
| `prisma-dte.adapter.ts` | Remove deleted fields from `save()` and `findByPeriod()` mapping |
| `fetch-dte-emails.handler.ts` | Inject `TaxpayerRepository`, call `upsert` for emisor+receptor before save |
| `get-dte-files.handler.ts` | `summary.activities` now reads from related `taxpayer.codActividad` via `activity` — or computed from records if `DteRecord` includes it |
| `dte.module.ts` | Import `TaxpayerModule` |

## `DteRecord` after changes

`issuerName`, `receiverName`, `issuerActivity` removed. These are now available via the `taxpayer` relation if needed. `DteRecord` returned by `GET /api/dte/:year/:month/:type` keeps `issuerNrc` and `receiverNrc` as identifiers.

## Migration Strategy

1. Create `activity` and `taxpayer` tables
2. Add FK relations to `dte` (`issuer_nrc`, `receiver_nrc` as FK)
3. **Data migration:** populate `taxpayer` and `activity` from existing `dte.raw_json` records
4. Drop `issuer_name`, `receiver_name`, `issuer_activity` columns from `dte`
5. Alter `receiver_nrc` to nullable

> **Note:** Step 3 requires a data migration script before step 4. Existing rows must have a matching `taxpayer` row before the FK constraint is enforced.

## Out of Scope

- Factura support (receiver NRC = null) — schema supports it, no handler logic needed yet
- Querying taxpayers directly via API endpoint
- Updating taxpayer data independently of sync
