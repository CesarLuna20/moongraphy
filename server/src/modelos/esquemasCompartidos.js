import mongoose from "mongoose";

export const EsquemaEntradaHistorial = new mongoose.Schema(
  {
    timestamp: { type: Date, required: true },
    type: { type: String, required: true },
    summary: { type: String, required: true }
  },
  { _id: false }
);

export const EsquemaServicioResumen = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    status: { type: String, enum: ["pending", "active", "completed"], default: "pending" },
    createdAt: { type: Date, default: Date.now },
    notes: { type: String }
  },
  { _id: false }
);

export const EsquemaDisponibilidad = new mongoose.Schema(
  {
    id: { type: String, required: true },
    dayOfWeek: { type: Number, min: 0, max: 6, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true }
  },
  { _id: false }
);

export const EsquemaPreferenciasNotificacion = new mongoose.Schema(
  {
    pushEnabled: { type: Boolean, default: true },
    inAppEnabled: { type: Boolean, default: true },
    confirmation: { type: Boolean, default: true },
    reminder48h: { type: Boolean, default: true },
    reminder24h: { type: Boolean, default: true },
    changes: { type: Boolean, default: true }
  },
  { _id: false }
);

export const EsquemaFoto = new mongoose.Schema(
  {
    id: { type: String, required: true },
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    storagePath: { type: String, required: true },
    url: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);
