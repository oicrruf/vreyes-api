# DTE Extracción CCF desde PDF con Groq Vision — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extender `POST /api/dte/upload` para que acepte PDFs de CCF físicos sin JSON — el sistema extrae datos via Groq Vision, enriquece desde la BD de taxpayers, y guarda igual que el flujo manual.

**Architecture:** Se agrega un nuevo port `LlmDteExtractorPort` con su adaptador `GroqVisionAdapter` (modelo `meta-llama/llama-4-scout-17b-16e-instruct`). El controlador detecta si viene JSON (flujo actual) o solo PDFs (nuevo flujo de extracción). Un nuevo handler `ExtractDteFromFilesHandler` orquesta: validación total del lote → extracción Groq → enriquecimiento con taxpayer data → guardado paralelo.

**Tech Stack:** NestJS + CQRS, TypeScript, Groq API (vision), `pdfjs-dist` + `canvas` (PDF→PNG en Node), Prisma 7, Google Drive, PostgreSQL (Supabase).

**Spec:** `docs/superpowers/specs/2026-04-19-dte-extraccion-vision-design.md`

---

## Mapa de archivos

### Crear

| Archivo | Responsabilidad |
|---|---|
| `src/modules/llm/domain/ports/llm-dte-extractor.port.ts` | Puerto de extracción DTE desde imagen |
| `src/modules/llm/infrastructure/adapters/groq-vision.adapter.ts` | Llamada a Groq Vision con system prompt CCF |
| `src/shared/pdf/pdf-to-image.service.ts` | Convierte PDF (primera página) → PNG base64 |
| `src/modules/dte/application/commands/extract-dte-from-files/extract-dte-from-files.command.ts` | Comando batch de extracción |
| `src/modules/dte/application/commands/extract-dte-from-files/extract-dte-from-files.handler.ts` | Orquesta validación → extracción → enriquecimiento → save |

### Modificar

| Archivo | Cambio |
|---|---|
| `src/modules/dte/domain/entities/dte-document.entity.ts` | Agregar `numeroControl`; fallback de `codigoGeneracion` a `numeroControl` |
| `src/modules/llm/llm.module.ts` | Registrar `GroqVisionAdapter`, exportar `LLM_DTE_EXTRACTOR` |
| `src/modules/dte/application/commands/upload-sale-dte/upload-sale-dte.handler.ts` | `fileId = codigoGeneracion \|\| numeroControl` para nombres en Drive |
| `src/modules/dte/infrastructure/http/dto/upload-sale-dte.dto.ts` | `json` opcional, `pdf` acepta múltiples, Swagger actualizado |
| `src/modules/dte/infrastructure/http/dte.controller.ts` | `maxCount: 12`, routing Caso A vs B, validación nombre coincidente |
| `src/modules/dte/dte.module.ts` | Registrar `ExtractDteFromFilesHandler`, `PdfToImageService`, `LLM_DTE_EXTRACTOR` |
| `src/modules/dte/domain/ports/dte-repository.port.ts` | Agregar `findByNumeroControl` |
| `src/modules/dte/infrastructure/adapters/prisma-dte.adapter.ts` | Implementar `findByNumeroControl` |

---

## Task 1: Instalar dependencias

**Files:**
- Modify: `package.json`

- [x] **Step 1: Instalar pdfjs-dist y canvas**
- [x] **Step 2: Verificar instalación**

---

## Task 2: Actualizar `DteDocument` — agregar `numeroControl`

**Files:**
- Modify: `src/modules/dte/domain/entities/dte-document.entity.ts`

- [x] **Step 1: Actualizar la entidad**
- [x] **Step 2: Verificar compilación**

---

## Task 3: Crear `LlmDteExtractorPort`

**Files:**
- Create: `src/modules/llm/domain/ports/llm-dte-extractor.port.ts`

- [x] **Step 1: Crear el puerto**

---

## Task 4: Crear `GroqVisionAdapter`

**Files:**
- Create: `src/modules/llm/infrastructure/adapters/groq-vision.adapter.ts`

- [x] **Step 1: Crear el adaptador**
- [x] **Step 2: Verificar compilación**

---

## Task 5: Crear `PdfToImageService`

**Files:**
- Create: `src/shared/pdf/pdf-to-image.service.ts`

- [x] **Step 1: Crear el servicio**
- [x] **Step 2: Verificar compilación**

---

## Task 6: Actualizar `LlmModule`

**Files:**
- Modify: `src/modules/llm/llm.module.ts`

- [x] **Step 1: Registrar y exportar GroqVisionAdapter**
- [x] **Step 2: Verificar compilación**

---

## Task 7: Crear `ExtractDteFromFilesCommand`

**Files:**
- Create: `src/modules/dte/application/commands/extract-dte-from-files/extract-dte-from-files.command.ts`

- [x] **Step 1: Crear el comando**

---

## Task 8: Crear `ExtractDteFromFilesHandler`

**Files:**
- Create: `src/modules/dte/application/commands/extract-dte-from-files/extract-dte-from-files.handler.ts`

- [x] **Step 1: Crear el handler**
- [x] **Step 2: Verificar compilación**

---

## Task 9: Actualizar `UploadSaleDteHandler` — usar `fileId` para nombres en Drive

**Files:**
- Modify: `src/modules/dte/application/commands/upload-sale-dte/upload-sale-dte.handler.ts`

- [x] **Step 1: Cambiar las líneas de nombre de archivo**
- [x] **Step 2: Verificar compilación**

---

## Task 10: Actualizar el DTO de Swagger

**Files:**
- Modify: `src/modules/dte/infrastructure/http/dto/upload-sale-dte.dto.ts`

- [x] **Step 1: Actualizar el DTO**

---

## Task 11: Actualizar `DteController`

**Files:**
- Modify: `src/modules/dte/infrastructure/http/dte.controller.ts`

- [x] **Step 1: Agregar import de `ExtractDteFromFilesCommand`**
- [x] **Step 2: Reemplazar el método `uploadSaleDte` completo**
- [x] **Step 3: Verificar compilación**

---

## Task 12: Actualizar `DteModule`

**Files:**
- Modify: `src/modules/dte/dte.module.ts`

- [x] **Step 1: Registrar nuevos providers**
- [x] **Step 2: Verificar compilación completa**

---

## Task 13: Prueba de humo en local

- [x] **Step 1: Arrancar el servidor**
- [x] **Step 2: Probar Caso A — JSON sin PDF (flujo existente)**
- [x] **Step 3: Probar Caso B — PDF con imagen**
- [x] **Step 4: Probar rechazo de imagen directa**
- [x] **Step 5: Probar nombre no coincidente (Caso A)**

---

## Commit final

- [x] **Commit único con todos los cambios**
