export const ANALYTICS_REPOSITORY = 'ANALYTICS_REPOSITORY';

export interface SpendingResult {
  name: string;
  total: number;
  count: number;
}

export interface AnalyticsRepository {
  getSpendingAggregation(params: {
    nrc: string;
    type: 'purchase' | 'sale';
    year: number;
    month?: number;
  }): Promise<SpendingResult[]>;
}
