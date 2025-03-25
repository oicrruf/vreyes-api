import mongoose, { Schema, Document } from "mongoose";

// Define the interface without id (Mongoose will handle that)
interface District {
  name: string;
  municipalityId: string;
  code?: string;
}

export interface DistrictDocument extends Document, District {}

const DistrictSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    municipalityId: {
      type: Schema.Types.ObjectId,
      ref: "Municipality",
      required: true,
    },
    code: { type: String, required: false },
    // Add other fields as needed
  },
  { timestamps: true }
);

export default mongoose.model<DistrictDocument>("distrito", DistrictSchema);
