import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetDteFilesQuery } from './get-dte-files.query';
import { DteRepository, DteRecord, DTE_REPOSITORY } from '../../../domain/ports/dte-repository.port';

interface CountEntry {
  name: string;
  count: number;
}

interface DteSummary {
  activities: CountEntry[];
  categories: CountEntry[];
}

export interface GetDteFilesResult {
  period: string;
  type: string;
  count: number;
  records: DteRecord[];
  summary: DteSummary;
}

@QueryHandler(GetDteFilesQuery)
export class GetDteFilesHandler implements IQueryHandler<GetDteFilesQuery, GetDteFilesResult> {
  constructor(@Inject(DTE_REPOSITORY) private readonly dteRepository: DteRepository) {}

  async execute(query: GetDteFilesQuery): Promise<GetDteFilesResult> {
    const { year, month, type } = query;

    const records = await this.dteRepository.findByPeriod(year, month, type);

    return {
      period: `${year}-${month.toString().padStart(2, '0')}`,
      type,
      count: records.length,
      records,
      summary: this.buildSummary(records),
    };
  }

  private buildSummary(records: DteRecord[]): DteSummary {
    const activityCounts = new Map<string, number>();
    const categoryCounts = new Map<string, number>();

    for (const record of records) {
      if (record.issuerActivity) {
        activityCounts.set(
          record.issuerActivity,
          (activityCounts.get(record.issuerActivity) ?? 0) + 1,
        );
      }

      if (Array.isArray(record.itemsCategory)) {
        for (const cat of record.itemsCategory) {
          categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
        }
      }
    }

    const toSorted = (map: Map<string, number>): CountEntry[] =>
      Array.from(map.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

    return {
      activities: toSorted(activityCounts),
      categories: toSorted(categoryCounts),
    };
  }
}
