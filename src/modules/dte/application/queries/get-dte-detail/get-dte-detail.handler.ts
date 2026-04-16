import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { GetDteDetailQuery } from './get-dte-detail.query';
import { DteRepository, DTE_REPOSITORY } from '../../../domain/ports/dte-repository.port';

@QueryHandler(GetDteDetailQuery)
export class GetDteDetailHandler implements IQueryHandler<GetDteDetailQuery> {
  constructor(@Inject(DTE_REPOSITORY) private readonly dteRepository: DteRepository) {}

  async execute(query: GetDteDetailQuery): Promise<object> {
    const rawJson = await this.dteRepository.findRawJson(query.generationCode) as any;
    if (!rawJson) {
      throw new NotFoundException(`DTE ${query.generationCode} not found`);
    }
    return rawJson.cuerpoDocumento ?? [];
  }
}
