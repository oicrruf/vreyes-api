import { IVentaItem } from "../interfaces/venta.interface";

export class CreateVentaDto {
  tipo: "FACTURA" | "CCF";
  numeroDocumento: string;
  fecha: Date;
  clienteId: string;
  items: IVentaItem[];
  subtotal: number;
  iva: number;
  total: number;
}
