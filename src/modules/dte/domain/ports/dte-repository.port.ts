import { DteDocument } from '../entities/dte-document.entity';

export const DTE_REPOSITORY = 'DTE_REPOSITORY';

export type DteType = 'purchase' | 'sale';

export interface DteRepository {
  save(dte: DteDocument, type: DteType, pdfUrl?: string, rawJson?: object): Promise<void>;
  findByGenerationCode(code: string): Promise<DteDocument | null>;
  findAll(type?: DteType): Promise<DteDocument[]>;
}
