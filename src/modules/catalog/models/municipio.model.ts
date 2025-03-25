import mongoose, { Schema, Document } from "mongoose";

// Define the interface without id (Mongoose will handle that)
interface Municipality {
  name: string;
  departmentId: string;
  code?: string;
}

export interface MunicipalityDocument extends Document, Municipality {}

const MunicipalitySchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },
    code: { type: String, required: false },
    // Add other fields as needed
  },
  { timestamps: true }
);

export default mongoose.model<MunicipalityDocument>(
  "municipio",
  MunicipalitySchema
);
