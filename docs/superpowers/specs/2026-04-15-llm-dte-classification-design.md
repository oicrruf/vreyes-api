# LLM DTE Classification — Design Spec
**Date:** 2026-04-15  
**Status:** Approved

## Goal

Use Groq (free tier, Llama 3.3-70b) to enrich persisted DTE records with two AI-derived fields:

1. `issuer_activity` — business line of the DTE issuer, extracted directly from `raw_json.emisor.descActividad` (no LLM)
2. `items_category` — array of categories (one per `cuerpoDocumento` entry), classified by Llama

## Architecture

Follows existing hexagonal/CQRS pattern. New `llm` module added alongside `dte` and `auth`.

```
src/modules/llm/
  domain/
    ports/
      llm-classifier.port.ts       # LlmClassifierPort interface
  infrastructure/
    adapters/
      groq.adapter.ts              # GroqAdapter implements LlmClassifierPort
  llm.module.ts
```

## Domain Port

```ts
// src/modules/llm/domain/ports/llm-classifier.port.ts
export interface LlmClassifierPort {
  classifyItems(descriptions: string[]): Promise<string[]>;
}
```

- Input: array of item descriptions from `cuerpoDocumento[].descripcion`
- Output: `string[]` parallel to input — one category per item
- Categories are open (Llama decides): "gasolina", "fontanería", "hardware", "seguros", etc.

## Groq Adapter

- Provider: `https://api.groq.com/openai/v1` (OpenAI-compatible)
- Model: `llama-3.3-70b-versatile`
- Mode: `response_format: { type: "json_object" }` — forces structured JSON output
- One API call per DTE (all items in a single prompt)
- Prompt instructs Llama to return `{ "categories": ["cat1", "cat2", ...] }` in same order as input

## Prisma Schema Changes

```prisma
model Dte {
  // ... existing fields ...
  issuerActivity  String?  @map("issuer_activity")
  itemsCategory   Json?    @map("items_category")  // string[]
}
```

New migration required.

## Integration Flow

Triggered after a DTE is persisted (inside `FetchDteEmailsHandler`):

```
raw_json
  ├─ emisor.descActividad  ──────────────────► issuerActivity (direct, no LLM)
  └─ cuerpoDocumento[].descripcion ─► Groq ──► itemsCategory (string[])
```

Both fields updated via `PrismaService` after classification.

## Environment Variables

| Variable | Description |
|---|---|
| `GROQ_API_KEY` | Groq API key from console.groq.com (already obtained) |

## Error Handling

- If Groq call fails: log error, leave `itemsCategory` as `null` (non-blocking — DTE already persisted)
- If `cuerpoDocumento` missing or empty: skip LLM call, set `itemsCategory` to `[]`
- If `emisor.descActividad` missing: set `issuerActivity` to `null`

## GET /api/dte/:year/:month/:type — Summary Field

The existing query response is extended with a `summary` key computed in `GetDteFilesHandler` from the already-fetched records (no extra DB query).

### Response shape

```json
{
  "success": true,
  "period": "2026-04",
  "type": "purchase",
  "count": 10,
  "records": [...],
  "summary": {
    "activities": [
      { "name": "Venta al por menor", "count": 5 },
      { "name": "Servicios de transporte", "count": 3 }
    ],
    "categories": [
      { "name": "gasolina", "count": 8 },
      { "name": "hardware", "count": 2 }
    ]
  }
}
```

### Aggregation logic

- `activities`: group records by `issuerActivity`, count per unique value. Records with `null` issuerActivity are excluded.
- `categories`: flatten all `itemsCategory` arrays across all records, count per unique category string. Records with `null` itemsCategory are excluded.
- Both arrays sorted descending by `count`.

### Changes required

- `GetDteFilesResult` interface gains `summary` field
- `GetDteFilesHandler.execute()` computes summary after fetching records
- `DteRecord` type (in `dte-repository.port.ts`) gains `issuerActivity` and `itemsCategory` fields

## Out of Scope

- Retrying failed classifications (can be added later)
- Batch reprocessing of existing DTEs (separate task)
- Caching LLM responses
