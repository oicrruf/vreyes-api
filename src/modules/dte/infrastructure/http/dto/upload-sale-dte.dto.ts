import { ApiPropertyOptional } from '@nestjs/swagger';

export class UploadSaleDteDto {
  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Archivo JSON del DTE. Requerido si no se envían PDFs para extracción automática.',
  })
  json?: Express.Multer.File;

  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description:
      'Uno o varios PDFs del CCF (máx. 12). Si no hay JSON, se extraen los datos con IA. Si hay JSON, el PDF debe tener el mismo nombre (sin extensión).',
  })
  pdf?: Express.Multer.File[];
}
