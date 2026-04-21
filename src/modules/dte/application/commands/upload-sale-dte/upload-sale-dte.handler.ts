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
    const jsonFilename = `${dteDoc.fileId}.json`;
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
      const pdfFilename = `${dteDoc.fileId}.pdf`;
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
