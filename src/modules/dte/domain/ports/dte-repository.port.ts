import { DteDocument } from '../entities/dte-document.entity';

export const DTE_REPOSITORY = 'DTE_REPOSITORY';

export type DteType = 'purchase' | 'sale';

export interface DteRecord {
  generationCode: string;
  type: DteType;
  issueDate: string;
  receiverNrc: string;
  receiverName: string;
  issuerNrc: string;
  issuerName: string;
  exemptTotal: number;
  taxableTotal: number;
  amountDue: number;
  taxValue: number;
  pdfUrl: string | null;
  issuerActivity: string | null;
  itemsCategory: string[] | null;
  createdAt: Date;
}

export interface DteRepository {
  save(dte: DteDocument, type: DteType, pdfUrl?: string, rawJson?: object): Promise<void>;
  findByGenerationCode(code: string): Promise<DteDocument | null>;
  findAll(type?: DteType): Promise<DteDocument[]>;
  findByPeriod(year: number, month: number, type: DteType): Promise<DteRecord[]>;
  findRawJson(generationCode: string): Promise<object | null>;
  updateClassification(
    generationCode: string,
    issuerActivity: string | null,
    itemsCategory: string[],
  ): Promise<void>;
}
