import {
  prop,
  getModelForClass,
  modelOptions,
  Severity,
} from "@typegoose/typegoose";
import { BaseModel } from "../../../models/base.model";

class Direccion {
  @prop({ required: true })
  public departamento!: string;

  @prop({ required: true })
  public municipio!: string;

  @prop()
  public complemento?: string;
}

@modelOptions({
  schemaOptions: {
    collection: "clientes",
  },
  options: {
    allowMixed: Severity.ALLOW,
  },
})
export class Cliente extends BaseModel {
  @prop({ required: true, unique: true })
  public nrc!: string;

  @prop({ required: true })
  public nit!: string;

  @prop({ required: true })
  public nombre!: string;

  @prop()
  public codActividad?: string;

  @prop()
  public descActividad?: string;

  @prop()
  public nombreComercial?: string;

  @prop()
  public telefono?: string;

  @prop()
  public correo?: string;

  @prop({ type: () => Direccion })
  public direccion?: Direccion;

  @prop({ default: true })
  public activo: boolean = true;
}

// Exporta el modelo para usar en servicios
export const ClienteModel = getModelForClass(Cliente);
