import {
  CommandHandler,
  ICommandHandler,
} from '@nestjs/cqrs';
import {
  Inject,
  UnprocessableEntityException,
  ConflictException,
} from '@nestjs/common';
import { ExtractDteFromFilesCommand } from './extract-dte-from-files.command';
import {
  LlmDteExtractorPort,
  LLM_DTE_EXTRACTOR,
} from '../../../../llm/domain/ports/llm-dte-extractor.port';
import {
  LlmClassifierPort,
  LLM_CLASSIFIER,
} from '../../../../llm/domain/ports/llm-classifier.port';
import {
  FileStoragePort,
  FILE_STORAGE,
} from '../../../domain/ports/file-storage.port';
import {
  DteRepository,
  DTE_REPOSITORY,
} from '../../../domain/ports/dte-repository.port';
import {
  TaxpayerRepository,
  TAXPAYER_REPOSITORY,
} from '../../../../../modules/taxpayer/domain/ports/taxpayer-repository.port';
import { PdfToImageService } from '../../../../../shared/pdf/pdf-to-image.service';
import { DteDocument } from '../../../domain/entities/dte-document.entity';
import { LogService } from '../../../../../shared/logging/log.service';
import { UploadSaleDteResult } from '../upload-sale-dte/upload-sale-dte.handler';

export type ExtractDteResult = UploadSaleDteResult & { autogenerado: true };

/** Campos mínimos que debe tener un JSON extraído de CCF para ser considerado válido */
function validateCcfFields(rawJson: any, index: number): void {
  const id = rawJson?.identificacion;
  const cuerpo = rawJson?.cuerpoDocumento;
  const resumen = rawJson?.resumen;

  if (id?.tipoDte !== '03') {
    throw new UnprocessableEntityException(
      `Archivo ${index + 1}: el documento no es un CCF (tipoDte debe ser "03").`,
    );
  }
  if (!rawJson?.emisor?.nit) {
    throw new UnprocessableEntityException(
      `Archivo ${index + 1}: no se pudo extraer el NIT del emisor.`,
    );
  }
  if (!Array.isArray(cuerpo) || cuerpo.length === 0) {
    throw new UnprocessableEntityException(
      `Archivo ${index + 1}: cuerpoDocumento vacío o ausente.`,
    );
  }
  if (!resumen?.totalPagar || resumen.totalPagar <= 0) {
    throw new UnprocessableEntityException(
      `Archivo ${index + 1}: totalPagar inválido o ausente.`,
    );
  }
}

@CommandHandler(ExtractDteFromFilesCommand)
export class ExtractDteFromFilesHandler
  implements ICommandHandler<ExtractDteFromFilesCommand, ExtractDteResult[]>
{
  constructor(
    @Inject(LLM_DTE_EXTRACTOR) private readonly dteExtractor: LlmDteExtractorPort,
    @Inject(LLM_CLASSIFIER) private readonly llmClassifier: LlmClassifierPort,
    @Inject(FILE_STORAGE) private readonly fileStorage: FileStoragePort,
    @Inject(DTE_REPOSITORY) private readonly dteRepository: DteRepository,
    @Inject(TAXPAYER_REPOSITORY) private readonly taxpayerRepository: TaxpayerRepository,
    private readonly pdfToImage: PdfToImageService,
    private readonly logService: LogService,
  ) {}

  async execute(command: ExtractDteFromFilesCommand): Promise<ExtractDteResult[]> {
    // ─── FASE 1: VALIDACIÓN (si cualquier archivo falla → rechaza TODO el lote) ───

    // Convertir + extraer en paralelo
    const extracted = await Promise.all(
      command.pdfBuffers.map(async (pdfBuffer, i) => {
        let rawJson: any;
        try {
          const imageBase64 = await this.pdfToImage.toBase64Png(pdfBuffer);
          rawJson = await this.dteExtractor.extractFromImage(imageBase64);
        } catch (err: any) {
          throw new UnprocessableEntityException(
            `Archivo ${i + 1}: no se pudo extraer datos CCF — ${err.message}`,
          );
        }
        return { rawJson, pdfBuffer, index: i };
      }),
    );

    // Validar campos CCF mínimos
    for (const { rawJson, index } of extracted) {
      validateCcfFields(rawJson, index);
    }

    // Construir DteDocument y verificar duplicados
    const dteDocs = extracted.map(({ rawJson, pdfBuffer }) => {
      const doc = DteDocument.fromJson(rawJson);
      if (!doc || !doc.codigoGeneracion) {
        throw new UnprocessableEntityException(
          'No se pudo construir el documento DTE desde el JSON extraído.',
        );
      }
      return { doc, rawJson, pdfBuffer };
    });

    await Promise.all(
      dteDocs.map(async ({ doc }) => {
        const existing = await this.dteRepository.findByGenerationCode(doc.codigoGeneracion);
        if (existing) {
          throw new ConflictException(
            `El DTE ${doc.codigoGeneracion} ya existe en la base de datos.`,
          );
        }
      }),
    );

    // ─── FASE 2: GUARDADO (solo si validación 100% OK) ───

    const results = await Promise.all(
      dteDocs.map(({ doc, rawJson, pdfBuffer }) =>
        this.saveDte(doc, rawJson, pdfBuffer),
      ),
    );

    return results;
  }

  private async saveDte(
    doc: DteDocument,
    rawJson: any,
    pdfBuffer: Buffer,
  ): Promise<ExtractDteResult> {
    // Enriquecer emisor desde BD si existe
    if (rawJson.emisor?.nrc) {
      const taxpayer = await this.taxpayerRepository.findByNrc(rawJson.emisor.nrc);
      if (taxpayer) {
        rawJson.emisor.nombre = rawJson.emisor.nombre || taxpayer.nombre;
        rawJson.emisor.nit = rawJson.emisor.nit || taxpayer.nit;
        rawJson.emisor.codActividad = rawJson.emisor.codActividad || taxpayer.codActividad;
        rawJson.emisor.descActividad = rawJson.emisor.descActividad || taxpayer.descActividad;
        rawJson.emisor.nombreComercial = rawJson.emisor.nombreComercial || taxpayer.nombreComercial;
      }
    }

    // Enriquecer receptor desde BD si existe
    if (rawJson.receptor?.nrc) {
      const taxpayer = await this.taxpayerRepository.findByNrc(rawJson.receptor.nrc);
      if (taxpayer) {
        rawJson.receptor.nombre = rawJson.receptor.nombre || taxpayer.nombre;
        rawJson.receptor.nit = rawJson.receptor.nit || taxpayer.nit;
        rawJson.receptor.codActividad = rawJson.receptor.codActividad || taxpayer.codActividad;
        rawJson.receptor.descActividad = rawJson.receptor.descActividad || taxpayer.descActividad;
        rawJson.receptor.nombreComercial = rawJson.receptor.nombreComercial || taxpayer.nombreComercial;
      }
    }

    // Marcar como autogenerado
    rawJson.autogenerado = true;

    // Carpeta Drive según fecha de emisión
    const fecEmi: string = rawJson.identificacion?.fecEmi ?? doc.fechaEmision;
    const [year, month] = fecEmi.split('-');
    const driveFolderPath = `dte/${year}/${month}/ventas`;

    // Subir PDF a Drive
    const pdfFilename = `${doc.fileId}.pdf`;
    let pdfUrl: string | undefined;
    const pdfDriveId = await this.fileStorage
      .upload(pdfFilename, pdfBuffer, 'application/pdf', driveFolderPath)
      .catch((err) => {
        this.logService.log(`Drive PDF upload failed: ${err.message}`, 'dte');
        return null;
      });
    if (pdfDriveId) {
      pdfUrl = `https://drive.google.com/file/d/${pdfDriveId}/view`;
    }

    // Subir JSON a Drive
    const jsonBuffer = Buffer.from(JSON.stringify(rawJson, null, 2), 'utf-8');
    const jsonFilename = `${doc.fileId}.json`;
    const jsonDriveId = await this.fileStorage
      .upload(jsonFilename, jsonBuffer, 'application/json', driveFolderPath)
      .catch((err) => {
        this.logService.log(`Drive JSON upload failed: ${err.message}`, 'dte');
        return null;
      });
    if (jsonDriveId) {
      this.logService.log(`Uploaded JSON to Drive: ${jsonDriveId}`, 'dte');
    }

    // Upsert emisor
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

    // Upsert receptor
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

    // Guardar DTE
    await this.dteRepository.save(doc, 'sale', pdfUrl, rawJson);
    this.logService.log(`Saved extracted DTE: ${doc.codigoGeneracion}`, 'dte');

    // Clasificar items (no bloqueante)
    let classification: string[] = [];
    try {
      const cuerpo: any[] = Array.isArray(rawJson.cuerpoDocumento)
        ? rawJson.cuerpoDocumento
        : [];
      const descriptions = cuerpo
        .map((item: any) => item?.descripcion)
        .filter((d): d is string => typeof d === 'string' && d.trim().length > 0);

      if (descriptions.length > 0) {
        classification = await this.llmClassifier.classifyItems(descriptions);
        await this.dteRepository.updateClassification(doc.codigoGeneracion, classification);
      }
    } catch (err: any) {
      this.logService.log(
        `Classification failed for ${doc.codigoGeneracion}: ${err.message}`,
        'dte',
      );
    }

    return {
      generationCode: doc.codigoGeneracion,
      issueDate: doc.fechaEmision,
      amountDue: doc.totalPagar,
      classification,
      autogenerado: true,
    };
  }
}
