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
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { FetchDteEmailsCommand } from '../../application/commands/fetch-dte-emails/fetch-dte-emails.command';
import { SendDteAttachmentsCommand } from '../../application/commands/send-dte-attachments/send-dte-attachments.command';
import { GetDteFilesQuery } from '../../application/queries/get-dte-files/get-dte-files.query';
import { GetDteDetailQuery } from '../../application/queries/get-dte-detail/get-dte-detail.query';
import { FetchDteDto } from './dto/fetch-dte.dto';
import { SendDteAttachmentsDto } from './dto/send-dte-attachments.dto';

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
