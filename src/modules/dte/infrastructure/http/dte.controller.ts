import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  HttpException,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { FetchDteEmailsCommand } from '../../application/commands/fetch-dte-emails/fetch-dte-emails.command';
import { SendDteAttachmentsCommand } from '../../application/commands/send-dte-attachments/send-dte-attachments.command';
import { GetDteFilesQuery } from '../../application/queries/get-dte-files/get-dte-files.query';
import { GetDteDetailQuery } from '../../application/queries/get-dte-detail/get-dte-detail.query';
import { FetchDteDto } from './dto/fetch-dte.dto';
import { SendDteAttachmentsDto } from './dto/send-dte-attachments.dto';
import { UploadSaleDteCommand } from '../../application/commands/upload-sale-dte/upload-sale-dte.command';
import { UploadSaleDteDto } from './dto/upload-sale-dte.dto';
import { ExtractDteFromFilesCommand } from '../../application/commands/extract-dte-from-files/extract-dte-from-files.command';

@ApiTags('DTE')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api')
export class DteController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('dte')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtiene correos del mes especificado y descarga adjuntos (DTE).' })
  @ApiResponse({ status: 200, description: 'Correos procesados con éxito.' })
  @ApiResponse({ status: 400, description: 'Parámetros inválidos.' })
  @ApiResponse({ status: 500, description: 'Error interno o de configuración.' })
  async fetchDteEmails(@Query() query: FetchDteDto) {
    if (!query.type || !['purchase', 'sale'].includes(query.type)) {
      throw new BadRequestException("El parámetro 'type' debe ser 'purchase' o 'sale'.");
    }

    const year = query.year ? Number(query.year) : undefined;
    const month = query.month ? Number(query.month) : undefined;

    if (year !== undefined && isNaN(year)) {
      throw new BadRequestException('El año debe ser un número válido.');
    }

    if (month !== undefined && (isNaN(month) || month < 1 || month > 12)) {
      throw new BadRequestException('El mes debe ser un número entre 1 y 12.');
    }

    try {
      const result = await this.commandBus.execute(
        new FetchDteEmailsCommand(query.type as 'purchase' | 'sale', year, month),
      );
      return {
        success: true,
        message: `Processed ${result.processed} emails. Downloaded ${result.downloaded} files.`,
        detail: result,
      };
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      if (err.message?.includes('RECEPTOR_NRC')) {
        throw new InternalServerErrorException(err.message);
      }
      throw new InternalServerErrorException('Internal server error');
    }
  }

  @Get('dte/:year/:month/:type')
  @ApiOperation({ summary: 'Consulta DTEs en base de datos por año, mes y tipo.' })
  @ApiParam({ name: 'year', type: Number, example: 2026 })
  @ApiParam({ name: 'month', type: Number, example: 4 })
  @ApiParam({ name: 'type', enum: ['purchase', 'sale'], description: 'purchase = compras, sale = ventas' })
  @ApiResponse({ status: 200, description: 'Registros recuperados con éxito.' })
  @ApiResponse({ status: 400, description: 'Parámetros inválidos.' })
  async getDteFiles(
    @Param('year') year: string,
    @Param('month') month: string,
    @Param('type') type: string,
  ) {
    if (type !== 'purchase' && type !== 'sale') {
      throw new BadRequestException("El parámetro 'type' debe ser 'purchase' o 'sale'.");
    }

    const yearNum = Number(year);
    const monthNum = Number(month);

    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      throw new BadRequestException('Año o mes inválido.');
    }

    try {
      const result = await this.queryBus.execute(
        new GetDteFilesQuery(yearNum, monthNum, type as 'purchase' | 'sale'),
      );
      return { success: true, ...result };
    } catch (err: any) {
      throw new InternalServerErrorException('Error interno al consultar registros.');
    }
  }

  @Get('dte/:generationCode/detail')
  @ApiOperation({ summary: 'Retorna el JSON crudo del DTE (cuerpoDocumento y estructura completa).' })
  @ApiParam({ name: 'generationCode', description: 'Código de generación del DTE' })
  @ApiResponse({ status: 200, description: 'JSON crudo del DTE.' })
  @ApiResponse({ status: 404, description: 'DTE no encontrado.' })
  async getDteDetail(@Param('generationCode') generationCode: string) {
    return this.queryBus.execute(new GetDteDetailQuery(generationCode));
  }

  @Post('dte/upload')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sube un DTE manualmente (JSON requerido, PDF opcional) O extrae datos de PDFs con IA (sin JSON, hasta 12 PDFs).',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadSaleDteDto })
  @ApiResponse({ status: 200, description: 'DTE(s) procesado(s) y guardado(s).' })
  @ApiResponse({ status: 400, description: 'Parámetros inválidos.' })
  @ApiResponse({ status: 409, description: 'Uno o más DTEs ya existen.' })
  @ApiResponse({ status: 422, description: 'No se pudo extraer CCF válido de uno o más PDFs.' })
  @ApiResponse({ status: 500, description: 'Error interno.' })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'json', maxCount: 1 },
      { name: 'pdf', maxCount: 12 },
    ]),
  )
  async uploadSaleDte(
    @UploadedFiles()
    files: {
      json?: Express.Multer.File[];
      pdf?: Express.Multer.File[];
    },
  ) {
    const jsonFile = files?.json?.[0];
    const pdfFiles = files?.pdf ?? [];

    // Caso: ningún archivo
    if (!jsonFile && pdfFiles.length === 0) {
      throw new BadRequestException('Se requiere al menos un archivo JSON o PDF.');
    }

    // Caso A: JSON presente → flujo manual
    if (jsonFile) {
      // Validar nombre coincidente si también viene PDF
      if (pdfFiles.length > 0) {
        const jsonName = jsonFile.originalname.replace(/\.[^.]+$/, '');
        const pdfName = pdfFiles[0].originalname.replace(/\.[^.]+$/, '');
        if (jsonName !== pdfName) {
          throw new BadRequestException(
            `El nombre del PDF ("${pdfFiles[0].originalname}") no coincide con el del JSON ("${jsonFile.originalname}").`,
          );
        }
      }

      try {
        const result = await this.commandBus.execute(
          new UploadSaleDteCommand(
            jsonFile.buffer,
            pdfFiles[0]?.buffer,
          ),
        );
        return { success: true, ...result };
      } catch (err: any) {
        if (err instanceof HttpException) throw err;
        throw new InternalServerErrorException('Error al procesar el DTE.');
      }
    }

    // Caso B: Solo PDFs → extracción automática con Groq Vision
    // Validar que todos sean PDF
    for (const file of pdfFiles) {
      if (file.mimetype !== 'application/pdf') {
        throw new BadRequestException(
          `Solo se permiten archivos PDF. "${file.originalname}" tiene tipo "${file.mimetype}".`,
        );
      }
    }

    try {
      const results = await this.commandBus.execute(
        new ExtractDteFromFilesCommand(pdfFiles.map((f) => f.buffer)),
      );
      return { success: true, results };
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException('Error al extraer y procesar los DTEs.');
    }
  }

  @Post('attachments/dte/email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Genera CSV desde Drive, envía por email y elimina JSONs.' })
  @ApiResponse({ status: 200, description: 'Email enviado con éxito.' })
  @ApiResponse({ status: 404, description: 'No se encontraron archivos en Drive.' })
  @ApiResponse({ status: 500, description: 'Error interno.' })
  async sendDteAttachments(@Body() body: SendDteAttachmentsDto) {
    try {
      const result = await this.commandBus.execute(
        new SendDteAttachmentsCommand(body.year, body.month, body.subject, body.message),
      );
      return {
        success: true,
        message: `Sent ${result.sentFiles.length} files via email`,
        ...result,
      };
    } catch (err: any) {
      if (err.message?.includes('No files found') || err.message?.includes('No PDF')) {
        throw new NotFoundException(err.message);
      }
      if (err.message?.includes('No recipients')) {
        throw new BadRequestException(err.message);
      }
      throw new InternalServerErrorException('Failed to process and send files via Drive');
    }
  }
}
