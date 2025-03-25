import mongoose, { Schema, Document } from "mongoose";

// Define the interface without id (Mongoose will handle that)
interface Department {
  name: string;
  code?: string;
}

export interface DepartmentDocument extends Document, Department {}

const DepartmentSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: false },
    // Add other fields as needed
  },
  { timestamps: true }
);

export default mongoose.model<DepartmentDocument>(
  "departamento",
  DepartmentSchema
);
