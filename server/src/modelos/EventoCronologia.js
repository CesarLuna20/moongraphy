import mongoose from "mongoose";

const EsquemaEventoCronologia = new mongoose.Schema(
  {
    id: { type: String, unique: true, required: true },
    type: { type: String, required: true },
    sessionId: { type: String },
    clientId: { type: String },
    photographerId: { type: String },
    galleryId: { type: String },
    actorId: { type: String },
    actorEmail: { type: String },
    actorName: { type: String },
    title: { type: String, required: true },
    description: { type: String },
    payload: { type: mongoose.Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

EsquemaEventoCronologia.index({ clientId: 1, createdAt: -1 });
EsquemaEventoCronologia.index({ sessionId: 1, createdAt: -1 });
EsquemaEventoCronologia.index({ photographerId: 1, createdAt: -1 });

export const ModeloEventoCronologia = mongoose.model("TimelineEvent", EsquemaEventoCronologia);
