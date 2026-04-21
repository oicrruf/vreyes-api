export class DteDocument {
  constructor(
    public readonly codigoGeneracion: string,
    public readonly fechaEmision: string,
    public readonly receptorNrc: string,
    public readonly receptorNombre: string,
    public readonly emisorNrc: string,
    public readonly emisorNombre: string,
    public readonly totalExenta: number,
    public readonly totalGravada: number,
    public readonly totalPagar: number,
    public readonly tributosValor: number,
    public readonly itemsCategory: string[] | null = null,
    public readonly numeroControl: string = '',
  ) {}

  static fromJson(json: any): DteDocument | null {
    try {
      const numeroControl: string = json.identificacion?.numeroControl ?? '';
      // CCF físico: codigoGeneracion es null → usar numeroControl como PK
      const rawCodigo: string | null = json.identificacion?.codigoGeneracion ?? null;
      const codigoGeneracion: string = rawCodigo
        ? rawCodigo.replace(/-/g, '')
        : numeroControl;

      return new DteDocument(
        codigoGeneracion,
        json.identificacion?.fecEmi ?? '',
        json.receptor?.nrc ?? '',
        json.receptor?.nombre ?? '',
        json.emisor?.nrc ?? '',
        json.emisor?.nombre ?? '',
        json.resumen?.totalExenta ?? 0,
        json.resumen?.totalGravada ?? 0,
        json.resumen?.totalPagar ?? 0,
        json.resumen?.tributos?.[0]?.valor ?? json.resumen?.tributos?.valor ?? 0,
        null,
        numeroControl,
      );
    } catch {
      return null;
    }
  }

  /** Retorna el identificador para nombres de archivo en Drive.
   *  DTE electrónico → codigoGeneracion (UUID sin guiones).
   *  CCF físico       → numeroControl (ej. "17DS000C-0050"). */
  get fileId(): string {
    return this.codigoGeneracion || this.numeroControl;
  }

  /** Retorna la fecha formateada DD/MM/YYYY para exportación CSV */
  get formattedDate(): string {
    if (!this.fechaEmision) return '';
    const date = new Date(this.fechaEmision);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}/${date.getFullYear()}`;
  }
}
