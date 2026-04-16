export const TAXPAYER_REPOSITORY = 'TAXPAYER_REPOSITORY';

export interface TaxpayerData {
  nit?: string | null;
  nombre: string;
  nombreComercial?: string | null;
  codActividad?: string | null;
  descActividad?: string | null;
  rawJson?: object | null;
}

export interface TaxpayerRepository {
  /**
   * Upserts activity (if codActividad present) and taxpayer in a single transaction.
   * nrc is the unique identifier — duplicate NRCs are never created.
   * NOTE: nrc is required here even though the DB column is nullable, because
   * the catalog lookup is always NRC-keyed. Null-NRC rows are not supported at sync time.
   */
  upsert(nrc: string, data: TaxpayerData): Promise<void>;
}
