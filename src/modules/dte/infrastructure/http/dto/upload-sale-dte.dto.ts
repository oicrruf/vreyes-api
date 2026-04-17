import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UploadSaleDteDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Archivo JSON del DTE (requerido)',
  })
  json: Express.Multer.File;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Archivo PDF del DTE (opcional)',
  })
  pdf?: Express.Multer.File;
}
