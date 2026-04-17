# Upload Sale DTE — Design Spec

**Date:** 2026-04-17  
**Status:** Approved

## Context

Sales (ventas) do not arrive via email — they are issued by the user. They must be uploaded manually. The upload endpoint reads the DTE date from the JSON and groups the record automatically, without requiring the caller to specify year/month.

## Endpoint

```
POST /api/dte/upload
Content-Type: multipart/form-data
Authorization: Bearer <JWT>

Fields:
  json  (file, required)  — Official DTE JSON
  pdf   (file, optional)  — DTE PDF
```

### Responses

**200 OK:**
```json
{
  "success": true,
  "generationCode": "7C7FDC36-...",
  "issueDate": "2026-01-14",
  "amountDue": 2279.65,
  "classification": ["Servicios de software"]
}
```

**400 Bad Request** — JSON not parseable or missing required DTE fields  
**409 Conflict** — DTE with same `codigoGeneracion` already exists  
**500 Internal Server Error** — DB or unrecoverable failure

## Architecture

### New files

```
src/modules/dte/
  application/commands/upload-sale-dte/
    upload-sale-dte.command.ts      ← payload: jsonBuffer, pdfBuffer?
    upload-sale-dte.handler.ts      ← main logic
  infrastructure/http/dto/
    upload-sale-dte.dto.ts          ← multipart field declarations (Swagger)
```

### Modified files

```
dte.controller.ts   ← new POST /api/dte/upload endpoint
dte.module.ts       ← register UploadSaleDteHandler in CommandHandlers
```

## Handler Flow

1. Parse JSON buffer → `DteDocument.fromJson()` → throw `BadRequestException` if null
2. Check `dteRepository.findByGenerationCode()` → throw `ConflictException` if exists
3. Extract `year`/`month` from `identificacion.fecEmi` → Drive path: `dte/{year}/{month}/ventas`
4. Upload JSON buffer to Google Drive (non-blocking on failure — log and continue)
5. Upload PDF buffer to Google Drive if provided (non-blocking — log and continue)
6. Upsert `emisor` in `taxpayer` table (skip if `emisor.nrc` absent)
7. Upsert `receptor` in `taxpayer` table (skip if `receptor.nrc` absent)
8. `dteRepository.save(dteDoc, 'sale', pdfUrl, rawJson)`
9. LLM classify items from `cuerpoDocumento[].descripcion` → `dteRepository.updateClassification()` (non-blocking — log and continue)
10. Return response with `generationCode`, `issueDate`, `amountDue`, `classification`

## Error Handling

| Case | Behavior |
|------|----------|
| JSON not parseable | `400 BadRequest` immediately |
| Valid JSON but missing DTE fields | `400 BadRequest` — `DteDocument.fromJson()` returns null |
| `codigoGeneracion` already in DB | `409 Conflict` |
| Drive upload fails (JSON or PDF) | Log + continue without blocking |
| LLM classification fails | Log + continue, classification returned as `[]` |
| `emisor.nrc` or `receptor.nrc` absent | Skip that taxpayer upsert, do not fail |

All non-blocking behaviors match the existing `FetchDteEmailsHandler` pattern.

## Reused Ports (no changes needed)

- `FileStoragePort` (`FILE_STORAGE`) — Google Drive upload
- `DteRepository` (`DTE_REPOSITORY`) — save, findByGenerationCode, updateClassification
- `TaxpayerRepository` (`TAXPAYER_REPOSITORY`) — upsert
- `LlmClassifierPort` (`LLM_CLASSIFIER`) — classifyItems
