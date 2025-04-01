import { IVentaItem } from "../interfaces/venta.interface";

export class CreateVentaDto {
  tipo: "FACTURA" | "CCF" = "FACTURA";
  numeroDocumento: string = "";
  fecha: Date = new Date();
  clienteId: string = "";
  items: IVentaItem[] = [];
  subtotal: number = 0;
  iva: number = 0;
  total: number = 0;
}
