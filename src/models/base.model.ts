import {
  prop,
  getModelForClass,
  modelOptions,
  Severity,
} from "@typegoose/typegoose";

@modelOptions({
  schemaOptions: {
    timestamps: true, // Añade createdAt y updatedAt automáticamente
    toJSON: {
      virtuals: true,
      transform: (_, ret) => {
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
  options: {
    allowMixed: Severity.ALLOW, // Permite tipos mixtos (flexible)
  },
})
export class BaseModel {
  @prop()
  public createdAt?: Date;

  @prop()
  public updatedAt?: Date;
}
