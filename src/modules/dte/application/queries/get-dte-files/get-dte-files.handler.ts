import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetDteFilesQuery } from './get-dte-files.query';
import { DteRepository, DteRecord, DTE_REPOSITORY } from '../../../domain/ports/dte-repository.port';

export interface GetDteFilesResult {
  period: string;
  type: string;
  count: number;
  records: DteRecord[];
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
    };
  }
}
