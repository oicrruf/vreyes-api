import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { AnalyticsRepository, SpendingResult } from '../../domain/ports/analytics-repository.port';

@Injectable()
export class PrismaAnalyticsAdapter implements AnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getSpendingAggregation(params: {
    nrc: string;
    type: 'purchase' | 'sale';
    year: number;
    month?: number;
  }): Promise<SpendingResult[]> {
    const colVendor = params.type === 'purchase' ? 'receiver_nrc' : 'issuer_nrc';
    const cleanNrc = params.nrc.replace(/-/g, '');
    
    // Construir filtros de fecha
    const dateFilter = params.month 
      ? `EXTRACT(YEAR FROM issue_date::date) = ${params.year} AND EXTRACT(MONTH FROM issue_date::date) = ${params.month}`
      : `EXTRACT(YEAR FROM issue_date::date) = ${params.year}`;

    const query = `
      SELECT 
        category AS name, 
        SUM(amount_due)::float AS total, 
        COUNT(*)::int AS count
      FROM dte, 
           jsonb_array_elements_text(COALESCE(items_category, '[]'::jsonb)) AS category
      WHERE ${colVendor} = '${cleanNrc}'
        AND ${dateFilter}
      GROUP BY category
      ORDER BY total DESC
    `;


    const results = await this.prisma.$queryRawUnsafe<any[]>(query);

    return results.map(r => ({
      name: r.name,
      total: r.total,
      count: r.count,
    }));
  }
}
