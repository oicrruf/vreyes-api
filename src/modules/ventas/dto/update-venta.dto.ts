import { IVentaItem } from "../interfaces/venta.interface";

export class UpdateVentaDto {
  tipo?: "FACTURA" | "CCF";
  numeroDocumento?: string;
  fecha?: Date;
  clienteId?: string;
  items?: IVentaItem[];
  subtotal?: number;
  iva?: number;
  total?: number;
  estado?: "ACTIVO" | "ANULADO";
}
