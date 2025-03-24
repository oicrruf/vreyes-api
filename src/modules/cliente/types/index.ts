export interface Direccion {
  departamento: string;
  municipio: string;
  complemento: string;
}

export interface Cliente {
  id: number;
  nit: string;
  nrc: string;
  nombre: string;
  codActividad?: string;
  descActividad?: string;
  nombreComercial?: string;
  telefono?: string;
  correo?: string;
  direccion?: Direccion;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReceptorDTO {
  receptor: {
    nit: string;
    nrc: string;
    nombre: string;
    codActividad: string;
    descActividad: string;
    nombreComercial: string;
    telefono: string;
    correo: string;
    direccion: {
      departamento: string;
      municipio: string;
      complemento: string;
    };
  };
}
