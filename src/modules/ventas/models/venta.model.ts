import mongoose, { Schema, Document } from "mongoose";
import { IVenta, IVentaItem } from "../interfaces/venta.interface";

const VentaItemSchema = new Schema<IVentaItem>({
  producto: { type: String, required: true },
  cantidad: { type: Number, required: true },
  precioUnitario: { type: Number, required: true },
  subtotal: { type: Number, required: true },
});

const VentaSchema = new Schema<IVenta & Document>(
  {
    tipo: {
      type: String,
      enum: ["FACTURA", "CCF"],
      required: true,
    },
    numeroDocumento: {
      type: String,
      required: true,
      unique: true,
    },
    fecha: {
      type: Date,
      required: true,
      default: Date.now,
    },
    clienteId: {
      type: String,
      required: true,
    },
    items: [VentaItemSchema],
    subtotal: {
      type: Number,
      required: true,
    },
    iva: {
      type: Number,
      required: true,
    },
    total: {
      type: Number,
      required: true,
    },
    estado: {
      type: String,
      enum: ["ACTIVO", "ANULADO"],
      default: "ACTIVO",
    },
  },
  { timestamps: true }
);

export default mongoose.model<IVenta & Document>("Venta", VentaSchema);
