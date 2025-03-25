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
  direccion: string;
  email: string;
  telefono: string;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
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
}
