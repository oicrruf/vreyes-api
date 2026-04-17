import { Controller, Get, Query, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiQuery, ApiOkResponse, ApiForbiddenResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { GetSpendingQuery } from '../../application/queries/get-spending/get-spending.query';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('spending')
  @ApiOperation({
    summary: 'Resumen de gastos/ventas por categoría',
    description: 'Agrega los montos de DTEs por categoría unnested de itemsCategory. Requiere vinculación con contribuyente.',
  })
  @ApiQuery({ name: 'year', type: Number, required: true, example: 2025 })
  @ApiQuery({ name: 'month', type: Number, required: false, example: 3 })
  @ApiQuery({ name: 'type', enum: ['purchase', 'sale', 'all'], required: false })
  @ApiOkResponse({ description: 'Estadísticas obtenidas correctamente' })
  @ApiForbiddenResponse({ description: 'El usuario no está vinculado a un contribuyente' })
  async getSpending(
    @Request() req: any,
    @Query('year') year: string,
    @Query('month') month?: string,
    @Query('type') type: 'purchase' | 'sale' | 'all' = 'all',
  ) {
    const user = req.user;
    if (!user || !user.taxpayer || !user.taxpayer.nrc) {
      throw new ForbiddenException('User is not linked to a taxpayer');
    }

    return this.queryBus.execute(
      new GetSpendingQuery(
        user.taxpayer.nrc,
        parseInt(year, 10),
        month ? parseInt(month, 10) : undefined,
        type,
      ),
    );
  }
}
