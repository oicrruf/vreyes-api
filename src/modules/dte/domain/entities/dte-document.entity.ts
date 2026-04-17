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
  ) {}

  static fromJson(json: any): DteDocument | null {
    try {
      return new DteDocument(
        json.identificacion?.codigoGeneracion?.replace(/-/g, '') ?? '',
        json.identificacion?.fecEmi ?? '',
        json.receptor?.nrc ?? '',
        json.receptor?.nombre ?? '',
        json.emisor?.nrc ?? '',
        json.emisor?.nombre ?? '',
        json.resumen?.totalExenta ?? 0,
        json.resumen?.totalGravada ?? 0,
        json.resumen?.totalPagar ?? 0,
        json.resumen?.tributos?.valor ?? 0,
      );
    } catch {
      return null;
    }
  }

  /** Returns the date formatted as DD/MM/YYYY for CSV export */
  get formattedDate(): string {
    if (!this.fechaEmision) return '';
    const date = new Date(this.fechaEmision);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}/${date.getFullYear()}`;
  }
}
