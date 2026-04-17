import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { AnalyticsRepository, SpendingAggregation } from '../../domain/ports/analytics-repository.port';

@Injectable()
export class PrismaAnalyticsAdapter implements AnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getSpendingAggregation(params: {
    nrc: string;
    type: 'purchase' | 'sale';
    year: number;
    month?: number;
  }): Promise<SpendingAggregation> {
    const colVendor = params.type === 'purchase' ? 'receiver_nrc' : 'issuer_nrc';
    const cleanNrc = params.nrc.replace(/-/g, '');

    const dateFilter = params.month
      ? `EXTRACT(YEAR FROM issue_date::date) = ${params.year} AND EXTRACT(MONTH FROM issue_date::date) = ${params.month}`
      : `EXTRACT(YEAR FROM issue_date::date) = ${params.year}`;

    // Grand total without category join — avoids double-counting DTEs with multiple categories
    const totalsQuery = `
      SELECT
        SUM(amount_due)::float AS total,
        COUNT(*)::int AS count
      FROM dte
      WHERE ${colVendor} = '${cleanNrc}'
        AND ${dateFilter}
    `;

    // Per-category breakdown: divide amount_due proportionally across categories
    // so that sum(category totals) = grand total
    const categoriesQuery = `
      SELECT
        category AS name,
        SUM(amount_due::float / NULLIF(jsonb_array_length(COALESCE(items_category, '[]'::jsonb)), 0))::float AS total,
        COUNT(*)::int AS count
      FROM dte
      CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(items_category, '[]'::jsonb)) AS category
      WHERE ${colVendor} = '${cleanNrc}'
        AND ${dateFilter}
      GROUP BY category
      ORDER BY total DESC
    `;

    const [totalsRows, categoryRows] = await Promise.all([
      this.prisma.$queryRawUnsafe<any[]>(totalsQuery),
      this.prisma.$queryRawUnsafe<any[]>(categoriesQuery),
    ]);

    return {
      total: totalsRows[0]?.total ?? 0,
      count: totalsRows[0]?.count ?? 0,
      categories: categoryRows.map(r => ({
        name: r.name,
        total: r.total,
        count: r.count,
      })),
    };
  }
}
