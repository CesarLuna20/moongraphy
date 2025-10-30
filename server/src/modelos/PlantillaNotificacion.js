import mongoose from "mongoose";

const EsquemaPlantillaNotificacion = new mongoose.Schema(
  {
    id: { type: String, unique: true, required: true },
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String },
    defaultBody: { type: String, required: true },
    body: { type: String, required: true },
    placeholders: { type: [String], default: [] },
    updatedAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

export const ModeloPlantillaNotificacion = mongoose.model(
  "NotificationTemplate",
  EsquemaPlantillaNotificacion
);
