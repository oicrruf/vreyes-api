import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FetchDteDto {
  @ApiProperty({ description: "Tipo de DTE a procesar: 'purchase' o 'sale'.", enum: ['purchase', 'sale'] })
  type: string;

  @ApiPropertyOptional({ description: 'Año a consultar (ej. 2026). Si se omite, usa el año actual.', type: Number })
  year?: number;

  @ApiPropertyOptional({ description: 'Mes a consultar (1-12). Si se omite, usa el mes actual.', type: Number })
  month?: number;
}
