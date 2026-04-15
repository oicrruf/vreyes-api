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
import { ApiTags, ApiSecurity, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiKeyGuard } from '../../../../shared/guards/api-key.guard';
import { FetchDteEmailsCommand } from '../../application/commands/fetch-dte-emails/fetch-dte-emails.command';
import { SendDteAttachmentsCommand } from '../../application/commands/send-dte-attachments/send-dte-attachments.command';
import { GetDteFilesQuery } from '../../application/queries/get-dte-files/get-dte-files.query';
import { FetchDteDto } from './dto/fetch-dte.dto';
import { SendDteAttachmentsDto } from './dto/send-dte-attachments.dto';

@ApiTags('DTE')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard)
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
  @ApiOperation({ summary: 'Lista los archivos DTE por año, mes y tipo (compras/ventas).' })
  @ApiResponse({ status: 200, description: 'Lista de archivos recuperada con éxito.' })
  @ApiResponse({ status: 400, description: 'Parámetros inválidos.' })
  @ApiResponse({ status: 404, description: 'El directorio solicitado no existe.' })
  async getDteFiles(
    @Param('year') year: string,
    @Param('month') month: string,
    @Param('type') type: string,
  ) {
    if (type !== 'compras' && type !== 'ventas') {
      throw new BadRequestException("El parámetro 'type' debe ser 'compras' o 'ventas'.");
    }

    try {
      const result = await this.queryBus.execute(
        new GetDteFilesQuery(year, month, type as 'compras' | 'ventas'),
      );
      return { success: true, ...result };
    } catch (err: any) {
      if (err.message?.includes('No files found')) {
        throw new NotFoundException(err.message);
      }
      throw new InternalServerErrorException('Error interno al listar archivos.');
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
