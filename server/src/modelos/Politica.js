import mongoose from "mongoose";

const EsquemaPolitica = new mongoose.Schema(
  {
    id: { type: String, unique: true, required: true },
    type: { type: String, required: true },
    version: { type: Number, required: true },
    settings: { type: mongoose.Schema.Types.Mixed, required: true },
    createdBy: { type: String },
    createdAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

export const ModeloPolitica = mongoose.model("Policy", EsquemaPolitica);
