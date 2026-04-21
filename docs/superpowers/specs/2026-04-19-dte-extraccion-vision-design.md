# Spec: Extracción de CCF desde PDF con Groq Vision

**Fecha:** 2026-04-19  
**Módulo:** DTE  
**Endpoint afectado:** `POST /api/dte/upload`

---

## Contexto

El endpoint `/api/dte/upload` actualmente acepta un JSON del DTE más un PDF opcional. Se extiende para permitir subir uno o varios PDFs de Comprobantes de Crédito Fiscal (CCF) sin JSON — el sistema extrae los datos automáticamente usando Groq Vision (`meta-llama/llama-4-scout-17b-16e-instruct`), enriquece con datos de taxpayer almacenados, y guarda igual que el flujo manual.

---

## Casos de uso

### Caso A: JSON + PDF (flujo actual, con validación de nombre)

- El campo `json` está presente.
- El campo `pdf` es opcional (puede ser uno).
- Si ambos vienen, los nombres de archivo (sin extensión) deben coincidir exactamente.
  - Ej: `DTE-03-M001-001.json` + `DTE-03-M001-001.pdf` → válido.
  - Ej: `DTE-03-M001-001.json` + `otro.pdf` → `400 Bad Request`: "El nombre del PDF no coincide con el del JSON."
- Se usa el JSON tal cual.
- Se sube PDF a Drive si viene.
- Se hace upsert de emisor/receptor.
- Se guarda el DTE.
- **Se clasifican los items via LLM** (ya existía).
- No se llama a Groq Vision. No se convierte PDF a imagen.

### Caso B: Solo PDF(s), sin JSON — modo extracción automática

- El campo `json` está ausente.
- El campo `pdf` acepta entre 1 y 12 archivos.
- Máximo 12 PDFs por lote (un mes por archivo, hasta un año).
- **Fase de validación** — si cualquier archivo falla, se rechaza todo el lote:
  1. Validar que todos los archivos sean `application/pdf`. Si hay imagen (JPEG/PNG/etc.) → `400 Bad Request`.
  2. Convertir cada PDF a imagen PNG (primera página) con `pdfjs-dist` + `canvas`.
  3. Enviar cada imagen a Groq Vision con el system prompt del CCF → recibir JSON extraído.
  4. Validar campos CCF mínimos en cada JSON:
     - `identificacion.tipoDte === "03"`
     - `emisor.nit` presente y no vacío
     - `cuerpoDocumento` es array no vacío
     - `resumen.totalPagar > 0`
  5. Verificar duplicados en DB, rechaza todo el lote si alguno existe:
     - DTE electrónico (`codigoGeneracion` presente): `findByGenerationCode(codigoGeneracion)`.
     - DTE físico (`codigoGeneracion = null`): buscar por `numeroControl` — requiere método `findByNumeroControl` en `DteRepository`.
     - Si alguno ya existe → `409 Conflict`.
- **Fase de guardado** — solo si validación 100% exitosa:
  1. Para cada DTE extraído:
     - Buscar `emisor.nrc` en `TaxpayerRepository`. Si existe → merge de campos nulos en el JSON extraído: `emisor.nombre`, `emisor.codActividad`, `emisor.descActividad`, `emisor.nombreComercial`, `emisor.nit`.
     - Buscar `receptor.nrc` en `TaxpayerRepository`. Si existe → merge de campos nulos: `receptor.nombre`, `receptor.codActividad`, `receptor.descActividad`, `receptor.nombreComercial`, `receptor.nit`.
     - Agregar `rawJson.autogenerado = true` para indicar revisión manual requerida.
     - Upload del PDF original + JSON generado a Google Drive (`dte/{year}/{month}/ventas`). Nombre de archivo: `{numeroControl}.pdf` / `{numeroControl}.json`.
     - Upsert de emisor y receptor en `TaxpayerRepository`.
     - Save del DTE en DB con flag `autogenerado`.
     - Clasificar items via `LlmClassifierPort` (no bloqueante).
  2. Retornar array de resultados, uno por PDF procesado.

---

## Arquitectura — Nuevos componentes

### LlmModule

**`src/modules/llm/domain/ports/llm-dte-extractor.port.ts`**

```ts
export const LLM_DTE_EXTRACTOR = 'LLM_DTE_EXTRACTOR';

export interface LlmDteExtractorPort {
  extractFromImage(imageBase64: string): Promise<unknown>;
}
```

**`src/modules/llm/infrastructure/adapters/groq-vision.adapter.ts`**

- Implementa `LlmDteExtractorPort`.
- Modelo: `meta-llama/llama-4-scout-17b-16e-instruct`.
- Endpoint: `https://api.groq.com/openai/v1/chat/completions`.
- System prompt: el prompt de extracción CCF definido en la tarea.
- Mensaje de usuario: imagen en base64 con `image_url` (formato `data:image/png;base64,...`).
- `response_format: { type: 'json_object' }`, `temperature: 0`.
- Retorna JSON parseado (`unknown`). El handler valida la estructura.

### Shared

**`src/shared/pdf/pdf-to-image.service.ts`**

- Dependencias npm: `pdfjs-dist`, `canvas`.
- Método: `toBase64Png(pdfBuffer: Buffer): Promise<string>`.
- Renderiza la primera página del PDF a un canvas y retorna PNG en base64.
- Sin dependencias del sistema operativo.

### DteModule

**`src/modules/dte/application/commands/extract-dte-from-files/extract-dte-from-files.command.ts`**

```ts
export class ExtractDteFromFilesCommand {
  constructor(public readonly pdfBuffers: Buffer[]) {}
}
```

**`src/modules/dte/application/commands/extract-dte-from-files/extract-dte-from-files.handler.ts`**

- Orquesta Fase validación → Fase guardado según el flujo descrito arriba.
- Inyecta: `LLM_DTE_EXTRACTOR`, `PdfToImageService`, `TaxpayerRepository`, `DteRepository`, `FileStoragePort`, `LLM_CLASSIFIER`, `LogService`.
- Extracción Groq en paralelo (`Promise.all`) durante la fase de validación.
- Guardado en paralelo (`Promise.all`) — no hay dependencias entre DTEs del mismo lote.
- Retorna `ExtractDteResult[]` donde `ExtractDteResult` extiende `UploadSaleDteResult` con `autogenerado: true`.

---

## Cambios en componentes existentes

### `UploadSaleDteCommand` y `UploadSaleDteHandler`

Sin cambios de interfaz. **Cambio de comportamiento:** nombre de archivo en Drive usa `codigoGeneracion` si existe, `numeroControl` como fallback (CCF físicos).

- `const fileId = dteDoc.codigoGeneracion || dteDoc.numeroControl`
- `jsonFilename = \`${fileId}.json\``
- `pdfFilename = \`${fileId}.pdf\``

`DteDocument` no expone `numeroControl` actualmente — se agrega como campo al constructor y a `fromJson` (`json.identificacion?.numeroControl ?? ''`).

### `DteRepository` — nuevo método

```ts
findByNumeroControl(numeroControl: string): Promise<DteDocument | null>
```

Necesario para dedup de CCF físicos (donde `codigoGeneracion = null`).

### `DteController`

- Campo `pdf` cambia a `maxCount: 12`.
- `json` pasa a ser opcional (ya lo era en el interceptor, se valida en handler).
- Si `json` ausente y `pdf` presente → despachar `ExtractDteFromFilesCommand`.
- Si `json` presente → despachar `UploadSaleDteCommand` (igual que hoy).
- Si ninguno presente → `400 Bad Request`.

### `DteModule`

- Agregar `ExtractDteFromFilesHandler` a providers.
- Agregar `{ provide: LLM_DTE_EXTRACTOR, useClass: GroqVisionAdapter }`.
- Agregar `PdfToImageService` a providers (o importar desde SharedModule).
- `LlmModule` ya está importado — exportar `LLM_DTE_EXTRACTOR` desde él.

---

## Respuestas de error

| Condición | Código | Mensaje |
|---|---|---|
| Archivo no es PDF | 400 | "Solo se permiten archivos PDF." |
| Más de 12 PDFs | 400 | "Máximo 12 archivos por lote." |
| JSON ni PDF enviados | 400 | "Se requiere al menos un archivo JSON o PDF." |
| Nombre JSON ≠ nombre PDF | 400 | "El nombre del PDF no coincide con el del JSON." |
| Extracción Groq falla | 422 | "No se pudo extraer datos CCF del archivo: {filename}" |
| Campos CCF insuficientes | 422 | "El archivo no contiene un CCF válido: {filename}" |
| DTE ya existe en DB | 409 | "El DTE {codigoGeneracion} ya existe." |

---

## Respuesta exitosa

**Caso A** (JSON + PDF, flujo actual): respuesta sin cambios.
```json
{ "success": true, "generationCode": "...", "issueDate": "...", "amountDue": 0, "classification": [] }
```

**Caso B** (solo PDFs): array de resultados.

```json
{
  "success": true,
  "results": [
    {
      "generationCode": "...",
      "issueDate": "2026-03-15",
      "amountDue": 2300.00,
      "classification": ["servicios profesionales"],
      "autogenerado": true
    }
  ]
}
```

---

## Dependencias npm a instalar

- `pdfjs-dist` — renderizado de PDF en Node
- `canvas` — implementación de canvas para pdfjs-dist (binarios precompilados)

---

## System prompt de extracción

El system prompt completo para Groq Vision está definido en la tarea original. Se almacena como constante en `groq-vision.adapter.ts`. Instruye al modelo a retornar únicamente JSON válido con el schema del DTE El Salvador (tipoDte "03", versión 3).

---

## Fuera de alcance

- Soporte para imágenes (JPEG/PNG) directas — solo PDF.
- Extracción de DTEs de tipo distinto a CCF (tipoDte "03").
- Interfaz de revisión manual de DTEs con `autogenerado: true` — eso es trabajo futuro.
- Reintento automático si Groq falla en un archivo.
