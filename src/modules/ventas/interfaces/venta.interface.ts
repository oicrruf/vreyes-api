export interface IVentaItem {
  producto: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface IVenta {
  _id?: string;
  tipo: "FACTURA" | "CCF"; // Tipo de documento
  numeroDocumento: string;
  fecha: Date;
  clienteId: string; // Ensure this is typed as string to match the model
  items: IVentaItem[];
  subtotal: number;
  iva: number;
  total: number;
  estado: "ACTIVO" | "ANULADO";
  createdAt?: Date;
  updatedAt?: Date;
}
