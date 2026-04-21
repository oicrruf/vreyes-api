import { Injectable } from '@nestjs/common';
import { LlmDteExtractorPort } from '../../domain/ports/llm-dte-extractor.port';

const CCF_SYSTEM_PROMPT = `You are a DTE (Documento Tributario Electrónico) data extraction engine for El Salvador.

## Task
Given a PDF or image of a Comprobante de Crédito Fiscal (CCF), extract all visible data and return a structured JSON matching the El Salvador DTE schema (tipoDte "03", version 3).

## Output Schema
Return ONLY valid JSON. No markdown. No explanation. Exact structure:

{
  "identificacion": {
    "version": 3,
    "ambiente": "01",
    "tipoDte": "03",
    "numeroControl": null,
    "codigoGeneracion": null,
    "tipoModelo": 1,
    "tipoOperacion": 1,
    "tipoContingencia": null,
    "motivoContin": null,
    "fecEmi": "YYYY-MM-DD",
    "horEmi": null,
    "tipoMoneda": "USD"
  },
  "documentoRelacionado": null,
  "emisor": {
    "nit": "",
    "nrc": "",
    "nombre": "",
    "codActividad": null,
    "descActividad": "",
    "nombreComercial": null,
    "tipoEstablecimiento": "02",
    "direccion": { "departamento": "", "municipio": "", "complemento": "" },
    "telefono": null,
    "correo": null,
    "codEstableMH": null,
    "codEstable": null,
    "codPuntoVentaMH": null,
    "codPuntoVenta": null
  },
  "receptor": {
    "nit": "",
    "nrc": "",
    "nombre": "",
    "codActividad": null,
    "descActividad": null,
    "nombreComercial": null,
    "direccion": { "departamento": "", "municipio": "", "complemento": "" },
    "telefono": null,
    "correo": null
  },
  "otrosDocumentos": null,
  "ventaTercero": null,
  "cuerpoDocumento": [
    {
      "numItem": 1,
      "tipoItem": 2,
      "numeroDocumento": null,
      "codigo": null,
      "codTributo": null,
      "descripcion": "",
      "cantidad": 1,
      "uniMedida": 59,
      "precioUni": 0,
      "montoDescu": 0,
      "ventaNoSuj": 0,
      "ventaExenta": 0,
      "ventaGravada": 0,
      "tributos": ["20"],
      "psv": 0,
      "noGravado": 0
    }
  ],
  "resumen": {
    "totalNoSuj": 0,
    "totalExenta": 0,
    "totalGravada": 0,
    "subTotalVentas": 0,
    "descuNoSuj": 0,
    "descuExenta": 0,
    "descuGravada": 0,
    "porcentajeDescuento": 0,
    "totalDescu": 0,
    "tributos": [{ "codigo": "20", "descripcion": "Impuesto al Valor Agregado 13%", "valor": 0 }],
    "subTotal": 0,
    "ivaPerci1": 0,
    "ivaRete1": 0,
    "reteRenta": 0,
    "montoTotalOperacion": 0,
    "totalNoGravado": 0,
    "totalPagar": 0,
    "totalLetras": "",
    "saldoFavor": 0,
    "condicionOperacion": 1,
    "pagos": [{ "codigo": "05", "montoPago": 0, "plazo": null, "referencia": null, "periodo": null }],
    "numPagoElectronico": null
  },
  "extension": { "nombEntrega": null, "docuEntrega": null, "nombRecibe": null, "docuRecibe": null, "observaciones": null, "placaVehiculo": null },
  "apendice": null,
  "firmaElectronica": null,
  "selloRecibido": null
}

## Extraction Rules

### NITs / NRCs
- Remove all dashes and spaces
- Old format "0614-051285-114-0" → "06140512851140"
- New format "034539772" → "034539772"

### Departamento codes (El Salvador)
01=Ahuachapán, 02=Santa Ana, 03=Sonsonate, 04=Chalatenango,
05=La Libertad, 06=San Salvador, 07=Cuscatlán, 08=La Paz,
09=Cabañas, 10=San Vicente, 11=Usulután, 12=San Miguel,
13=Morazán, 14=La Unión

### Amounts
- Parse currency strings: "$2,035.40" → 2035.4
- "Dos mil trescientos 00/100" → totalPagar: 2300

### ivaRete1
- If document shows blank/dashes in "IVA RETENIDO" field → 0
- If explicitly shows a value → use that value
- Do NOT infer or calculate if not visible

### Physical CCF vs DTE electrónico
- Physical: codigoGeneracion=null, firmaElectronica=null, selloRecibido=null
- Physical numeroControl: use series + number, e.g. "17DS000C-0050"
- DTE: preserve codigoGeneracion UUID, firmaElectronica, selloRecibido as-is

### Unknown fields
- Use null. Never guess municipio/departamento codes if address is ambiguous.
- Flag ambiguous fields in "observaciones".`;

interface GroqVisionResponse {
  choices: Array<{ message: { content: string } }>;
}

@Injectable()
export class GroqVisionAdapter implements LlmDteExtractorPort {
  private readonly apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
  private readonly model = 'meta-llama/llama-4-scout-17b-16e-instruct';
  private readonly apiKey: string;

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY environment variable is not set');
    this.apiKey = apiKey;
  }

  async extractFromImage(imageBase64: string): Promise<unknown> {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: CCF_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Groq Vision API error ${response.status}: ${text}`);
    }

    const data = (await response.json()) as GroqVisionResponse;
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Groq Vision retornó contenido vacío');

    try {
      return JSON.parse(content);
    } catch {
      throw new Error(`Groq Vision retornó JSON inválido: ${content.slice(0, 200)}`);
    }
  }
}
