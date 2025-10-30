import mongoose from "mongoose";

const EsquemaNotificacion = new mongoose.Schema(
  {
    id: { type: String, unique: true, required: true },
    userId: { type: String, required: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    sessionId: { type: String },
    channels: { type: [String], default: ["in-app"] },
    readAt: { type: Date },
    metadata: { type: mongoose.Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

EsquemaNotificacion.index({ userId: 1, createdAt: -1 });

export const ModeloNotificacion = mongoose.model("Notification", EsquemaNotificacion);
