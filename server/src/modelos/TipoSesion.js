import mongoose from "mongoose";

const EsquemaTipoSesion = new mongoose.Schema(
  {
    id: { type: String, unique: true, required: true },
    name: { type: String, required: true },
    normalizedName: { type: String, required: true },
    description: { type: String },
    archived: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

EsquemaTipoSesion.index({ normalizedName: 1 }, { unique: true });

export const ModeloTipoSesion = mongoose.model("SessionType", EsquemaTipoSesion);
