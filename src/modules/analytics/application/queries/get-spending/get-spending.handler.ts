import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetSpendingQuery } from './get-spending.query';
import { ANALYTICS_REPOSITORY, AnalyticsRepository, SpendingResult } from '../../../domain/ports/analytics-repository.port';

@QueryHandler(GetSpendingQuery)
export class GetSpendingHandler implements IQueryHandler<GetSpendingQuery> {
  constructor(
    @Inject(ANALYTICS_REPOSITORY) private readonly analyticsRepository: AnalyticsRepository,
  ) {}

  async execute(query: GetSpendingQuery) {
    const nrc = query.nrc;

    if (query.type === 'all') {
      const [purchase, sale] = await Promise.all([
        this.getSpendingData(nrc, 'purchase', query.year, query.month),
        this.getSpendingData(nrc, 'sale', query.year, query.month),
      ]);

      return {
        period: { year: query.year, month: query.month, type: 'all' },
        purchase,
        sale,
      };
    } else {
      return this.getSpendingData(nrc, query.type as 'purchase' | 'sale', query.year, query.month);
    }
  }

  private async getSpendingData(nrc: string, type: 'purchase' | 'sale', year: number, month?: number) {
    const currentResults = await this.analyticsRepository.getSpendingAggregation({
      nrc,
      type,
      year,
      month,
    });

    const compPeriod = this.getComparisonPeriod(year, month);
    const comparisonResults = await this.analyticsRepository.getSpendingAggregation({
      nrc,
      type,
      year: compPeriod.year,
      month: compPeriod.month,
    });

    return {
      period: { year, month, type },
      categories: currentResults,
      comparison: {
        period: compPeriod,
        categories: comparisonResults,
      },
    };
  }

  private getComparisonPeriod(year: number, month?: number) {
    if (month) {
      if (month === 1) {
        return { year: year - 1, month: 12 };
      }
      return { year, month: month - 1 };
    }
    return { year: year - 1 };
  }
}
