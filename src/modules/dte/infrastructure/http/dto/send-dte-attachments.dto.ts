import { ApiPropertyOptional } from '@nestjs/swagger';

export class SendDteAttachmentsDto {
  @ApiPropertyOptional({ description: 'Año del período a enviar. Si se omite, usa el mes anterior.' })
  year?: number;

  @ApiPropertyOptional({ description: 'Mes del período a enviar (1-12).' })
  month?: number;

  @ApiPropertyOptional({ description: 'Asunto del correo.' })
  subject?: string;

  @ApiPropertyOptional({ description: 'Cuerpo del correo.' })
  message?: string;
}
