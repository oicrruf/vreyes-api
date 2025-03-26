import mongoose, { Schema, Document } from "mongoose";

export interface ICliente extends Document {
  nit: string;
  nrc: string;
  nombre: string;
  nombreComercial: string;
  direccion: string;
  departamento: string;
  municipio: string;
  email: string;
  telefono: string;
  tipoContribuyente: string;
  condicionPago: string;
  metodoPago: string;
  activo: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const ClienteSchema = new Schema(
  {
    nit: { type: String, required: true },
    nrc: { type: String, required: true, unique: true },
    nombre: { type: String, required: true },
    nombreComercial: { type: String },
    direccion: { type: String },
    departamento: { type: String },
    municipio: { type: String },
    email: { type: String },
    telefono: { type: String },
    tipoContribuyente: {
      type: String,
      enum: ["grande", "mediano", "pequeño", "otro"],
      default: "otro",
    },
    condicionPago: { type: String, default: "contado" },
    metodoPago: { type: String, default: "efectivo" },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model<ICliente>("Cliente", ClienteSchema);
