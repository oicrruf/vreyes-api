import { ObjectId } from "mongodb";

export interface Direccion {
  departamento: string;
  municipio: string;
  distrito: string;
  complemento: string;
}

export interface Cliente {
  _id?: ObjectId;
  nit: string;
  nrc: string;
  nombre: string;
  nombreComercial?: string;
  direccion: string;
  departamento?: string;
  municipio?: string;
  email: string;
  telefono: string;
  tipoContribuyente?: "grande" | "mediano" | "pequeño" | "otro";
  condicionPago?: string;
  metodoPago?: string;
  activo: boolean;
  documento: string; // Add this field to match database schema
  createdAt: Date;
  updatedAt: Date;
  facturas?: ObjectId[];
}

export interface Receptor {
  nrc: string;
  nit: string;
  nombre: string;
  direccion?: string;
  correo?: string;
  telefono?: string;
}

export interface ReceptorDTO {
  receptor: Receptor;
  tipoContribuyente?: "grande" | "mediano" | "pequeño" | "otro";
  nombreComercial?: string;
  condicionPago?: string;
  metodoPago?: string;
  departamento?: string;
  municipio?: string;
}
