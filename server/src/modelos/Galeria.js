import mongoose from "mongoose";

import { EsquemaFoto, EsquemaEntradaHistorial } from "./esquemasCompartidos.js";

const EsquemaGaleria = new mongoose.Schema(
  {
    id: { type: String, unique: true, required: true },
    sessionId: { type: String, required: true },
    photographerId: { type: String, required: true },
    clientId: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String },
    status: {
      type: String,
      enum: ["pending", "review", "delivered", "received"],
      default: "pending"
    },
    photos: { type: [EsquemaFoto], default: [] },
    deliveredAt: { type: Date },
    receivedAt: { type: Date },
    history: { type: [EsquemaEntradaHistorial], default: [] },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

EsquemaGaleria.index({ photographerId: 1, createdAt: -1 });
EsquemaGaleria.index({ clientId: 1, createdAt: -1 });
EsquemaGaleria.index({ sessionId: 1 });
EsquemaGaleria.index({ status: 1 });

export const ModeloGaleria = mongoose.model("Gallery", EsquemaGaleria);
